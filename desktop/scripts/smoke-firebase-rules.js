const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require('@firebase/rules-unit-testing');
const {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  serverTimestamp, Timestamp
} = require('firebase/firestore');
const {
  ref, set, get, remove, update
} = require('firebase/database');

const root = path.resolve(__dirname, '..');
const firestoreRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const databaseRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'database.rules.json'), 'utf8');
const projectId = 'demo-banana-cord';

function emulator(name, fallbackPort) {
  const raw = process.env[name] || `127.0.0.1:${fallbackPort}`;
  const match = raw.match(/^(.+):(\d+)$/);
  return { host: match?.[1] || '127.0.0.1', port: Number(match?.[2] || fallbackPort) };
}
const firestoreEmulator = emulator('FIRESTORE_EMULATOR_HOST', 8080);
const databaseEmulator = emulator('FIREBASE_DATABASE_EMULATOR_HOST', 9000);

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { ...firestoreEmulator, rules: firestoreRules },
    database: { ...databaseEmulator, rules: databaseRules }
  });

  const verified = (uid) => env.authenticatedContext(uid, {
    email: `${uid}@bananacord.test`,
    email_verified: true
  });
  const unverified = (uid) => env.authenticatedContext(uid, {
    email: `${uid}@bananacord.test`,
    email_verified: false
  });

  try {
    await env.clearFirestore();
    await env.clearDatabase();

    const owner = verified('owner');
    const member = verified('member');
    const outsider = verified('outsider');
    const noVerify = unverified('not-verified');
    const anon = env.unauthenticatedContext();

    const ownerDb = owner.firestore();
    const memberDb = member.firestore();
    const outsiderDb = outsider.firestore();
    const noVerifyDb = noVerify.firestore();
    const anonDb = anon.firestore();

    // E-mail verificado é obrigatório.
    await assertFails(setDoc(doc(noVerifyDb, 'publicProfiles', 'not-verified'), { displayName: 'Nope' }));
    await assertFails(setDoc(doc(anonDb, 'publicProfiles', 'anon'), { displayName: 'Anon' }));
    await assertSucceeds(setDoc(doc(ownerDb, 'publicProfiles', 'owner'), { displayName: 'Owner' }));
    await assertSucceeds(setDoc(doc(memberDb, 'publicProfiles', 'member'), { displayName: 'Member' }));

    // Fluxo real de criação de servidor: servidor + dono + canais + ref + convite no mesmo batch.
    const serverId = 'srv-test';
    const inviteCode = 'ABCD1234';
    const create = writeBatch(ownerDb);
    create.set(doc(ownerDb, 'servers', serverId), {
      name: 'Banana Test', ownerId: 'owner', icon: '', inviteCode,
      categories: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    create.set(doc(ownerDb, 'servers', serverId, 'members', 'owner'), {
      role: 'owner', joinedAt: serverTimestamp(), displayName: 'Owner'
    });
    create.set(doc(ownerDb, 'servers', serverId, 'channels', 'general'), {
      name: 'geral', type: 'text', position: 0, categoryId: null, allowedRoles: [], createdAt: serverTimestamp()
    });
    create.set(doc(ownerDb, 'servers', serverId, 'channels', 'voice-general'), {
      name: 'Geral', type: 'voice', position: 1, categoryId: null, allowedRoles: [], createdAt: serverTimestamp()
    });
    create.set(doc(ownerDb, 'users', 'owner', 'serverRefs', serverId), {
      serverId, role: 'owner', joinedAt: serverTimestamp()
    });
    create.set(doc(ownerDb, 'invites', inviteCode), {
      serverId, code: inviteCode, createdBy: 'owner', permanent: true, createdAt: serverTimestamp()
    });
    await assertSucceeds(create.commit());

    // Convite pode localizar o servidor, mas listar todos os servidores não pode.
    await assertSucceeds(getDoc(doc(memberDb, 'invites', inviteCode)));
    await assertSucceeds(getDoc(doc(memberDb, 'servers', serverId)));
    await assertFails(getDocs(collection(outsiderDb, 'servers')));

    // Entrada pelo convite grava membro + referência na conta no mesmo batch.
    const join = writeBatch(memberDb);
    join.set(doc(memberDb, 'servers', serverId, 'members', 'member'), {
      role: 'member', joinedAt: serverTimestamp(), joinedVia: inviteCode, displayName: 'Member'
    });
    join.set(doc(memberDb, 'users', 'member', 'serverRefs', serverId), {
      serverId, role: 'member', joinedAt: serverTimestamp()
    });
    await assertSucceeds(join.commit());

    // Membro lê canais e envia mensagem, mas não administra servidor.
    await assertSucceeds(getDocs(collection(memberDb, 'servers', serverId, 'channels')));
    await assertSucceeds(setDoc(doc(memberDb, 'servers', serverId, 'channels', 'general', 'messages', 'm1'), {
      authorId: 'member', text: 'oi', createdAt: serverTimestamp(), editedAt: null, reactions: {}, mentionIds: []
    }));
    await assertFails(updateDoc(doc(memberDb, 'servers', serverId), { name: 'Hack' }));

    // Dono promove moderador; moderador passa a criar canal, mas não muda nome do servidor.
    await assertSucceeds(updateDoc(doc(ownerDb, 'servers', serverId, 'members', 'member'), { role: 'moderator' }));
    await assertSucceeds(setDoc(doc(memberDb, 'servers', serverId, 'channels', 'mods'), {
      name: 'mods', type: 'text', position: 2, categoryId: null, allowedRoles: ['moderator'], createdAt: serverTimestamp()
    }));
    await assertFails(updateDoc(doc(memberDb, 'servers', serverId), { name: 'Moderador não é admin' }));

    // Convite expirado não permite entrada.
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'invites', 'EXPIRED1'), {
        serverId, code: 'EXPIRED1', createdBy: 'owner', permanent: false,
        expiresAt: Timestamp.fromMillis(Date.now() - 60000)
      });
    });
    const expiredUser = verified('expired-user');
    await assertFails(setDoc(doc(expiredUser.firestore(), 'servers', serverId, 'members', 'expired-user'), {
      role: 'member', joinedAt: serverTimestamp(), joinedVia: 'EXPIRED1', displayName: 'Expired'
    }));

    // Primeira DM: thread + primeira mensagem no mesmo batch (regressão importante da V2).
    const threadId = 'member_owner';
    const dmBatch = writeBatch(ownerDb);
    dmBatch.set(doc(ownerDb, 'dmThreads', threadId), {
      participants: ['member', 'owner'], updatedAt: serverTimestamp(), lastMessage: { text: 'oi', at: Date.now() }
    });
    dmBatch.set(doc(ownerDb, 'dmThreads', threadId, 'messages', 'dm1'), {
      fromId: 'owner', toId: 'member', text: 'oi', createdAt: serverTimestamp(), editedAt: null, reactions: {}
    });
    await assertSucceeds(dmBatch.commit());
    await assertSucceeds(getDocs(collection(memberDb, 'dmThreads', threadId, 'messages')));
    await assertFails(updateDoc(doc(memberDb, 'dmThreads', threadId, 'messages', 'dm1'), { text: 'não pode editar mensagem alheia' }));

    // Amizades/bloqueios ficam visíveis apenas aos participantes.
    await assertSucceeds(setDoc(doc(ownerDb, 'relationships', 'member_owner'), {
      participants: ['member', 'owner'], status: 'pending', requestedBy: 'owner', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(getDoc(doc(memberDb, 'relationships', 'member_owner')));
    await assertFails(getDoc(doc(outsiderDb, 'relationships', 'member_owner')));

    // Realtime Database: presença própria, sessão, voz e sinalização WebRTC.
    const ownerRt = owner.database();
    const memberRt = member.database();
    const outsiderRt = outsider.database();
    const noVerifyRt = noVerify.database();
    const anonRt = anon.database();

    await assertSucceeds(set(ref(ownerRt, 'presence/owner'), { state: 'online', lastChanged: Date.now(), displayName: 'Owner' }));
    await assertFails(set(ref(ownerRt, 'presence/member'), { state: 'online', lastChanged: Date.now() }));
    await assertFails(get(ref(noVerifyRt, 'presence')));
    await assertFails(get(ref(anonRt, 'presence')));

    await assertSucceeds(set(ref(ownerRt, 'sessionOwners/session-owner'), 'owner'));
    await assertSucceeds(set(ref(memberRt, 'sessionOwners/session-member'), 'member'));
    await assertFails(set(ref(ownerRt, 'sessionOwners/session-fake'), 'member'));

    await assertSucceeds(set(ref(ownerRt, `voiceRooms/${serverId}/voice-general/session-owner`), {
      userId: 'owner', user: { id: 'owner', name: 'Owner' },
      mediaState: { muted: false, camera: false, screen: false }, speaking: false,
      joinedAt: Date.now()
    }));
    await assertFails(set(ref(memberRt, `voiceRooms/${serverId}/voice-general/session-owner`), {
      userId: 'owner', user: { id: 'owner', name: 'Owner' },
      mediaState: { muted: false, camera: false, screen: false }, speaking: true,
      joinedAt: Date.now()
    }));

    await assertSucceeds(set(ref(ownerRt, 'signals/session-member/sig1'), {
      fromSocketId: 'session-owner', fromUserId: 'owner', fromUser: { id: 'owner', name: 'Owner' },
      data: { type: 'offer', sdp: 'fake' }, at: Date.now()
    }));
    await assertSucceeds(get(ref(memberRt, 'signals/session-member')));
    await assertFails(get(ref(ownerRt, 'signals/session-member')));
    await assertSucceeds(remove(ref(memberRt, 'signals/session-member/sig1')));
    await assertFails(set(ref(outsiderRt, 'signals/does-not-exist/sig2'), {
      fromSocketId: 'outsider', fromUserId: 'outsider', data: { type: 'offer' }, at: Date.now()
    }));

    // V2.0.12: convite de ligação privada só pode ser criado pelo chamador,
    // respondido pelo destinatário e observado apenas pelos dois participantes.
    const privateInvite = 'privateCallInvites/member/pv-test';
    await assertSucceeds(set(ref(ownerRt, privateInvite), {
      roomId: 'pv-test', fromUserId: 'owner', fromUser: { id: 'owner', name: 'Owner' },
      toUserId: 'member', status: 'ringing', createdAt: Date.now()
    }));
    await assertSucceeds(get(ref(memberRt, 'privateCallInvites/member')));
    await assertSucceeds(get(ref(ownerRt, privateInvite)));
    await assertFails(get(ref(outsiderRt, privateInvite)));
    await assertFails(update(ref(ownerRt, privateInvite), { status: 'accepted' }));
    await assertSucceeds(update(ref(memberRt, privateInvite), { status: 'accepted', respondedAt: Date.now() }));

    // Sala privada: apenas caller/callee leem e escrevem sessões; terceiro é bloqueado.
    const privateRoom = 'privateVoiceRooms/pv-test';
    await assertSucceeds(set(ref(ownerRt, privateRoom), {
      callerId: 'owner', calleeId: 'member', createdAt: Date.now()
    }));
    await assertSucceeds(get(ref(memberRt, privateRoom)));
    await assertFails(get(ref(outsiderRt, privateRoom)));
    await assertSucceeds(set(ref(ownerRt, `${privateRoom}/sessions/session-owner`), {
      userId: 'owner', user: { id: 'owner', name: 'Owner' },
      mediaState: { muted: false, camera: false, screen: false }, speaking: false,
      joinedAt: Date.now()
    }));
    await assertSucceeds(set(ref(memberRt, `${privateRoom}/sessions/session-member`), {
      userId: 'member', user: { id: 'member', name: 'Member' },
      mediaState: { muted: false, camera: false, screen: false }, speaking: false,
      joinedAt: Date.now()
    }));
    await assertFails(set(ref(outsiderRt, `${privateRoom}/sessions/session-outsider`), {
      userId: 'outsider', user: { id: 'outsider', name: 'Outsider' },
      mediaState: { muted: false, camera: false, screen: false }, speaking: false,
      joinedAt: Date.now()
    }));
    await assertSucceeds(remove(ref(memberRt, `${privateRoom}/sessions/session-member`)));

    console.log('Banana Cord V2 Firebase Security Rules emulator test: OK');
  } finally {
    await env.cleanup();
  }
}

main().catch(error => {
  console.error('Firebase rules emulator test failed:', error);
  process.exit(1);
});
