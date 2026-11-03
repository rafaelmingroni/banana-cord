const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { ref, uploadBytes, getBytes, deleteObject } = require('firebase/storage');

const root = path.resolve(__dirname, '..');
const storageRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'storage.rules'), 'utf8');
const projectId = 'demo-banana-cord';

function emulator(name, fallbackPort) {
  const raw = process.env[name] || `127.0.0.1:${fallbackPort}`;
  const match = raw.match(/^(.+):(\d+)$/);
  return { host: match?.[1] || '127.0.0.1', port: Number(match?.[2] || fallbackPort) };
}
const storageEmulator = emulator('FIREBASE_STORAGE_EMULATOR_HOST', 9199);
const bucket = `gs://${projectId}.appspot.com`;

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    storage: { ...storageEmulator, rules: storageRules }
  });
  const verified = uid => env.authenticatedContext(uid, {
    email: `${uid}@mingrx.test`,
    email_verified: true
  });
  const unverified = uid => env.authenticatedContext(uid, {
    email: `${uid}@mingrx.test`,
    email_verified: false
  });

  try {
    await env.clearStorage();
    const owner = verified('owner');
    const other = verified('other');
    const noVerify = unverified('not-verified');
    const anon = env.unauthenticatedContext();

    const ownerStorage = owner.storage(bucket);
    const otherStorage = other.storage(bucket);
    const noVerifyStorage = noVerify.storage(bucket);
    const anonStorage = anon.storage(bucket);

    const iconPath = 'mingrx/community-icons/owner/srv/icon.webp';
    const chatPath = 'mingrx/chat-media/owner/community-srv-general/print.webp';
    const smallImage = new Uint8Array(64 * 1024).fill(7);
    const oversizedImage = new Uint8Array(2 * 1024 * 1024 + 1).fill(9);

    await assertSucceeds(uploadBytes(ref(ownerStorage, iconPath), smallImage, { contentType: 'image/webp' }));
    await assertSucceeds(getBytes(ref(otherStorage, iconPath)));
    await assertFails(getBytes(ref(anonStorage, iconPath)));

    await assertFails(uploadBytes(ref(otherStorage, iconPath), smallImage, { contentType: 'image/webp' }));
    await assertFails(uploadBytes(ref(noVerifyStorage, 'mingrx/community-icons/not-verified/srv/icon.webp'), smallImage, { contentType: 'image/webp' }));
    await assertFails(uploadBytes(ref(ownerStorage, 'mingrx/community-icons/owner/srv/not-image.txt'), smallImage, { contentType: 'text/plain' }));
    await assertFails(uploadBytes(ref(ownerStorage, 'mingrx/community-icons/owner/srv/too-large.webp'), oversizedImage, { contentType: 'image/webp' }));

    await assertSucceeds(uploadBytes(ref(ownerStorage, chatPath), smallImage, { contentType: 'image/jpeg' }));
    await assertSucceeds(getBytes(ref(ownerStorage, chatPath)));
    await assertFails(deleteObject(ref(otherStorage, chatPath)));
    await assertSucceeds(deleteObject(ref(ownerStorage, chatPath)));
    await assertSucceeds(deleteObject(ref(ownerStorage, iconPath)));

    await assertFails(uploadBytes(ref(ownerStorage, 'other-prefix/file.webp'), smallImage, { contentType: 'image/webp' }));
    console.log('Mingrx Firebase Storage Security Rules emulator test: OK');
  } finally {
    await env.cleanup();
  }
}

main().catch(error => {
  console.error('Mingrx Storage rules emulator test failed:', error);
  process.exit(1);
});
