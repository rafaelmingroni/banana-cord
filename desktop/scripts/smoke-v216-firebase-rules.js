const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, getDocs, setDoc, updateDoc, serverTimestamp, writeBatch } = require('firebase/firestore');

const root = path.resolve(__dirname, '..');
const firestoreRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const projectId = 'demo-banana-cord';

function emulator(name, fallbackPort) {
  const raw = process.env[name] || `127.0.0.1:${fallbackPort}`;
  const match = raw.match(/^(.+):(\d+)$/);
  return { host: match?.[1] || '127.0.0.1', port: Number(match?.[2] || fallbackPort) };
}

const firestoreEmulator = emulator('FIRESTORE_EMULATOR_HOST', 8080);
const envelope = (senderKeyId, recipientKeyId) => ({
  version: 1,
  algorithm: 'X25519-AES-256-GCM',
  senderKeyId,
  recipientKeyId,
  iv: 'MTIzNDU2Nzg5MDEy',
  ciphertext: 'ZW5jcnlwdGVkLWJ5dGVz',
  tag: 'MTIzNDU2Nzg5MDEyMzQ1Ng=='
});

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { ...firestoreEmulator, rules: firestoreRules }
  });
  const verified = uid => env.authenticatedContext(uid, { email: `${uid}@bananacord.test`, email_verified: true });

  try {
    await env.clearFirestore();
    const alice = verified('alice');
    const bob = verified('bob');
    const mallory = verified('mallory');
    const aliceDb = alice.firestore();
    const bobDb = bob.firestore();
    const malloryDb = mallory.firestore();

    const aliceKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const bobKey = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const pub = 'MCowBQYDK2VuAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

    await assertSucceeds(setDoc(doc(aliceDb, 'e2eeKeys', 'alice'), {
      currentKeyId: aliceKey, algorithm: 'X25519', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(aliceDb, 'e2eeKeys', 'alice', 'keys', aliceKey), {
      keyId: aliceKey, publicKey: pub, algorithm: 'X25519', createdAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(bobDb, 'e2eeKeys', 'bob'), {
      currentKeyId: bobKey, algorithm: 'X25519', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(bobDb, 'e2eeKeys', 'bob', 'keys', bobKey), {
      keyId: bobKey, publicKey: pub, algorithm: 'X25519', createdAt: serverTimestamp()
    }));

    await assertFails(setDoc(doc(malloryDb, 'e2eeKeys', 'alice'), {
      currentKeyId: 'cccccccccccccccccccccccccccccccc', algorithm: 'X25519', updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(doc(aliceDb, 'e2eeKeys', 'alice', 'keys', aliceKey), { publicKey: `${pub}x` }));
    await assertFails(getDocs(collection(aliceDb, 'e2eeKeys')));
    await assertFails(getDocs(collection(aliceDb, 'e2eeKeys', 'alice', 'keys')));

    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'relationships', 'alice_bob'), {
        participants: ['alice', 'bob'], status: 'friends', requestedBy: 'alice', updatedAt: new Date()
      });
    });

    const makeThread = writeBatch(aliceDb);
    makeThread.set(doc(aliceDb, 'dmThreads', 'alice_bob'), {
      participants: ['alice', 'bob'], updatedAt: serverTimestamp(), lastMessage: { fromId: 'alice', toId: 'bob', at: Date.now(), e2ee: true }
    });
    makeThread.set(doc(aliceDb, 'dmThreads', 'alice_bob', 'messages', 'encrypted-1'), {
      fromId: 'alice', toId: 'bob', e2ee: envelope(aliceKey, bobKey), createdAt: serverTimestamp(), editedAt: null, replyToId: null, reactions: {}
    });
    await assertSucceeds(makeThread.commit());

    await assertSucceeds(setDoc(doc(bobDb, 'dmThreads', 'alice_bob', 'messages', 'encrypted-2'), {
      fromId: 'bob', toId: 'alice', e2ee: envelope(bobKey, aliceKey), createdAt: serverTimestamp(), editedAt: null, replyToId: null, reactions: {}
    }));

    await assertFails(setDoc(doc(aliceDb, 'dmThreads', 'alice_bob', 'messages', 'mixed'), {
      fromId: 'alice', toId: 'bob', text: 'não deve coexistir', e2ee: envelope(aliceKey, bobKey), createdAt: serverTimestamp(), editedAt: null, replyToId: null, reactions: {}
    }));

    await assertFails(setDoc(doc(aliceDb, 'dmThreads', 'alice_bob', 'messages', 'bad-alg'), {
      fromId: 'alice', toId: 'bob', e2ee: { ...envelope(aliceKey, bobKey), algorithm: 'ROT13' }, createdAt: serverTimestamp(), editedAt: null, replyToId: null, reactions: {}
    }));

    await assertFails(setDoc(doc(malloryDb, 'dmThreads', 'alice_bob', 'messages', 'spoof'), {
      fromId: 'alice', toId: 'bob', e2ee: envelope(aliceKey, bobKey), createdAt: serverTimestamp(), editedAt: null, replyToId: null, reactions: {}
    }));

    await assertSucceeds(updateDoc(doc(aliceDb, 'dmThreads', 'alice_bob', 'messages', 'encrypted-1'), {
      e2ee: { ...envelope(aliceKey, bobKey), ciphertext: 'bm92by1jaWZyYWRv' }, editedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(doc(aliceDb, 'dmThreads', 'alice_bob', 'messages', 'encrypted-1'), {
      text: 'tentativa de downgrade para plaintext', editedAt: serverTimestamp()
    }));

    console.log('Banana Cord V2.0.16 E2EE Firestore Rules test: OK');
  } finally {
    await env.cleanup();
  }
}

main().catch(error => {
  console.error('V2.0.16 E2EE rules test failed:', error);
  process.exit(1);
});
