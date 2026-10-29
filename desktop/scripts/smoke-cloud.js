const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'src', 'cloud-v2.js'), 'utf8');
const authFix = fs.readFileSync(path.join(root, 'src', 'cloud-v2-auth-fix.js'), 'utf8');
const socket = fs.readFileSync(path.join(root, 'src', 'cloud-v2-socket.js'), 'utf8');
const cloudBrowserPath = path.join(root, 'src', 'cloud-browser', 'cloud-v2.browser.js');
const authBrowserPath = path.join(root, 'src', 'cloud-browser', 'cloud-v2-auth-fix.browser.js');
const socketBrowserPath = path.join(root, 'src', 'cloud-browser', 'cloud-v2-socket.browser.js');
const configSource = fs.readFileSync(path.join(root, 'cloud', 'firebase-config.js'), 'utf8');
const firestoreRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const databaseRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'database.rules.json'), 'utf8');

function assert(ok, message) {
  if (!ok) { console.error(`Cloud smoke test failed: ${message}`); process.exit(1); }
}

for (const file of ['src/cloud-v2.js','src/cloud-v2-auth-fix.js','src/cloud-v2-socket.js','src/cloud-v2-legacy-bridge.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}
assert(/^2\.0\.0-cloud\./.test(pkg.version), 'preview version must use 2.0.0-cloud.x');
assert(pkg.dependencies?.firebase === '12.19.0', 'Firebase JS SDK must be pinned to 12.19.0');
assert(pkg.devDependencies?.esbuild === '0.28.2', 'esbuild must be pinned for browser Firebase bundling');
assert((pkg.build?.files || []).includes('cloud/**/*'), 'cloud config folder must be packaged');
assert(fs.existsSync(cloudBrowserPath) && fs.existsSync(authBrowserPath) && fs.existsSync(socketBrowserPath), 'all Firebase browser bundles must be generated');
const cloudBrowser = fs.readFileSync(cloudBrowserPath, 'utf8');
const authBrowser = fs.readFileSync(authBrowserPath, 'utf8');
const socketBrowser = fs.readFileSync(socketBrowserPath, 'utf8');
assert(index.includes('cloud-v2.css') && index.includes('cloud-browser/cloud-v2.browser.js'), 'cloud auth browser bundle must load');
assert(index.includes('cloud-browser/cloud-v2-auth-fix.browser.js'), 'browser-bundled registration guard must load');
assert(index.includes('cloud-browser/cloud-v2-socket.browser.js'), 'browser-bundled socket compatibility layer must load');
assert(index.includes('cloud-v2-legacy-bridge.js'), 'stable UI bridge must load');
assert(!index.includes('cloud-v2-home.js'), 'minimal cloud home must not replace stable UI');
for (const bundle of [cloudBrowser, authBrowser, socketBrowser]) assert(!bundle.includes("require('firebase/") && !bundle.includes('require("firebase/'), 'runtime Firebase require must not remain in browser bundle');
assert(cloud.includes('createUserWithEmailAndPassword') && cloud.includes('sendEmailVerification'), 'account creation / verification missing');
assert(authFix.includes('stopImmediatePropagation') && authFix.includes('sendEmailVerification'), 'verified-email registration guard missing');
assert(cloud.includes('browserLocalPersistence'), 'persistent auth session missing');
assert(cloud.includes('persistentLocalCache'), 'Firestore offline cache missing');
assert(cloud.includes('onDisconnect'), 'presence disconnect handling missing');
assert(socket.includes('BananaCloudSocket') && socket.includes("case 'server:create'") && socket.includes("case 'voice:join'"), 'full cloud protocol transport missing');
assert(!configSource.includes('private_key') && !configSource.includes('serviceAccount'), 'Firebase admin credentials must never be packaged');
assert(configSource.includes('banana-cord.firebaseapp.com') || configSource.includes("authDomain: ''"), 'Firebase authDomain must be injected or remain a clean template');
assert(configSource.includes('https://banana-cord-default-rtdb.firebaseio.com'), 'Realtime Database URL missing from build config');
assert(firestoreRules.includes('email_verified') && firestoreRules.includes('dmThreads') && firestoreRules.includes('relationships') && firestoreRules.includes('invites'), 'Firestore security rules incomplete');
assert(databaseRules.includes('email_verified') && databaseRules.includes('presence') && databaseRules.includes('voiceRooms') && databaseRules.includes('signals'), 'Realtime Database rules incomplete');
console.log(`Banana Cord ${pkg.version} full cloud foundation smoke test: OK`);
