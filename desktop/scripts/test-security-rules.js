require('./test-local-emulators');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, collection, getDoc, getDocs, setDoc, updateDoc, writeBatch, serverTimestamp, query, limit } = require('firebase/firestore');

(async () => {
  assert(process.env.FIRESTORE_EMULATOR_HOST, 'Security tests require the local emulator');
  const env = await initializeTestEnvironment({ projectId: 'demo-banana-cord', firestore: {
    rules: fs.readFileSync(path.join(__dirname, '../../firebase/firestore.rules'), 'utf8')
  } });
  let checks = 0;
  const yes = async operation => { await assertSucceeds(operation); checks++; };
  const no = async operation => { await assertFails(operation); checks++; };
  const user = id => env.authenticatedContext(id, { email: `${id}@test.invalid`, email_verified: true }).firestore();
  const alice = user('alice'), bob = user('bob'), stranger = user('stranger');
  const guest = env.unauthenticatedContext().firestore();
  const unverified = env.authenticatedContext('alice', { email: 'alice@test.invalid', email_verified: false }).firestore();
  const account = db => doc(db, 'users', 'alice');
  const community = db => doc(db, 'servers', 'security');
  const member = (db, uid) => doc(db, 'servers', 'security', 'members', uid);
  const channel = db => doc(db, 'servers', 'security', 'channels', 'general');
  try {
    await env.clearFirestore();
    await yes(setDoc(account(alice), { displayName: 'Alice', email: 'alice@test.invalid', emailVerified: true, updatedAt: serverTimestamp() }));
    await yes(getDoc(account(alice)));
    for (const db of [bob, guest, unverified]) {
      await no(getDoc(account(db)));
      await no(updateDoc(account(db), { displayName: 'Taken over' }));
    }
    for (const patch of [{ password: 'never-store-passwords' }, { refreshToken: 'never-store-tokens' }, { role: 'admin' }, { email: 'bob@test.invalid' }, { emailVerified: false }, { displayName: '' }, { avatar: 'https://example.invalid/tracker.png' }, { avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }, { customStatus: 'x'.repeat(81) }]) {
      await no(updateDoc(account(alice), patch));
    }
    await yes(setDoc(doc(alice, 'publicProfiles', 'alice'), { displayName: 'Alice', avatar: '', customStatus: '' }));
    await yes(getDocs(query(collection(bob, 'publicProfiles'), limit(20))));
    await no(getDocs(collection(bob, 'publicProfiles')));
    await no(getDocs(query(collection(bob, 'publicProfiles'), limit(51))));
    await no(setDoc(doc(bob, 'publicProfiles', 'alice'), { displayName: 'Spoofed' }));
    const create = writeBatch(alice);
    create.set(community(alice), { name: 'Security', ownerId: 'alice', icon: '', categories: [], createdAt: serverTimestamp() });
    create.set(member(alice, 'alice'), { role: 'owner', joinedAt: serverTimestamp() });
    create.set(channel(alice), { name: 'general', type: 'text', allowedRoles: [], position: 0 });
    create.set(doc(alice, 'invites', 'SECURE12'), { code: 'SECURE12', serverId: 'security', createdBy: 'alice', permanent: true, createdAt: serverTimestamp() });
    await yes(create.commit());
    await yes(setDoc(member(bob, 'bob'), { role: 'member', joinedVia: 'SECURE12', joinedAt: serverTimestamp() }));
    await no(updateDoc(member(bob, 'bob'), { role: 'owner' }));
    await no(setDoc(member(stranger, 'stranger'), { role: 'admin', joinedVia: 'SECURE12' }));
    await no(getDoc(community(stranger)));
    await no(getDocs(collection(stranger, 'servers', 'security', 'channels')));
    for (const patch of [{ ownerId: 'bob' }, { token: 'no-private-fields' }, { name: 'x'.repeat(41) }, { icon: 'javascript:alert(1)' }, { categories: new Array(101).fill({ name: 'oversize' }) }]) {
      await no(updateDoc(community(alice), patch));
    }
    await yes(updateDoc(community(alice), { name: 'Renamed' }));
    for (const patch of [{ allowedRoles: ['superuser'] }, { allowedRoles: 'admin' }, { type: 'voice' }, { position: -1 }, { token: 'unexpected' }, { name: '' }]) {
      await no(updateDoc(channel(alice), patch));
    }
    await yes(updateDoc(channel(alice), { name: 'chat', allowedRoles: ['admin'] }));
    await no(getDocs(collection(bob, 'servers', 'security', 'channels', 'general', 'messages')));
    await yes(updateDoc(channel(alice), { allowedRoles: [] }));
    await yes(getDocs(collection(bob, 'servers', 'security', 'channels', 'general', 'messages')));
    await no(updateDoc(member(alice, 'bob'), { role: 'superuser' }));
    await no(updateDoc(member(bob, 'bob'), { avatar: 'data:text/html;base64,PGgxPg==' }));
    await no(updateDoc(doc(alice, 'invites', 'SECURE12'), { token: 'unexpected' }));
    await no(updateDoc(doc(alice, 'invites', 'SECURE12'), { createdBy: 'bob' }));
    await no(setDoc(doc(alice, 'invites', 'BADOWNER'), { code: 'BADOWNER', serverId: 'security', createdBy: 'bob' }));
    await no(setDoc(doc(bob, 'invites', 'BADADMIN'), { code: 'BADADMIN', serverId: 'security' }));
    const relationship = { participants: ['alice', 'bob'], status: 'pending', requestedBy: 'alice' };
    await no(setDoc(doc(alice, 'relationships', 'alice_bob'), { ...relationship, secret: 'unexpected' }));
    await no(setDoc(doc(alice, 'relationships', 'bob_alice'), { ...relationship, participants: ['bob', 'alice'] }));
    await yes(setDoc(doc(alice, 'relationships', 'alice_bob'), relationship));
    await no(updateDoc(doc(alice, 'relationships', 'alice_bob'), { status: 'friends' }));
    await yes(updateDoc(doc(bob, 'relationships', 'alice_bob'), { status: 'friends', updatedAt: serverTimestamp() }));
    await no(getDoc(doc(stranger, 'relationships', 'alice_bob')));
    await no(setDoc(doc(alice, 'users', 'alice', 'serverRefs', 'security'), { serverId: 'other', role: 'owner' }));
    await no(setDoc(doc(alice, 'users', 'alice', 'serverRefs', 'security'), { serverId: 'security', password: 'unexpected' }));
    await yes(setDoc(doc(alice, 'users', 'alice', 'serverRefs', 'security'), { serverId: 'security', role: 'owner', joinedAt: serverTimestamp() }));
    await no(getDoc(doc(guest, 'invites', 'SECURE12')));
    await no(setDoc(doc(alice, 'unrecognized', 'document'), { public: true }));
    console.log(`Security rules: ${checks} authorization, schema, cross-account and restricted-channel checks passed.`);
  } finally { await env.cleanup(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
