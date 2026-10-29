const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'src', 'cloud-v2.js'), 'utf8');
const authFix = fs.readFileSync(path.join(root, 'src', 'cloud-v2-auth-fix.js'), 'utf8');
const cloudBrowserPath = path.join(root, 'src', 'cloud-browser', 'cloud-v2.browser.js');
const authBrowserPath = path.join(root, 'src', 'cloud-browser', 'cloud-v2-auth-fix.browser.js');
const configSource = fs.readFileSync(path.join(root, 'cloud', 'firebase-config.js'), 'utf8');
const firestoreRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const databaseRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'database.rules.json'), 'utf8');

function assert(ok, message) {
  if (!ok) {
    console.error(`Cloud smoke test failed: ${message}`);
    process.exit(1);
  }
}

execFileSync(process.execPath, ['--check', path.join(root, 'src', 'cloud-v2.js')], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', path.join(root, 'src', 'cloud-v2-auth-fix.js')], { stdio: 'inherit' });
assert(/^2\.0\.0-cloud\./.test(pkg.version), 'preview version must use 2.0.0-cloud.x');
assert(pkg.dependencies?.firebase === '12.19.0', 'Firebase JS SDK must be pinned to 12.19.0');
assert(pkg.devDependencies?.esbuild === '0.28.2', 'esbuild must be pinned for browser Firebase bundling');
assert((pkg.build?.files || []).includes('cloud/**/*'), 'cloud config folder must be packaged');
assert(fs.existsSync(cloudBrowserPath) && fs.existsSync(authBrowserPath), 'Firebase browser bundles were not generated');
const cloudBrowser = fs.readFileSync(cloudBrowserPath, 'utf8');
const authBrowser = fs.readFileSync(authBrowserPath, 'utf8');
assert(index.includes('cloud-v2.css') && index.includes('cloud-browser/cloud-v2.browser.js'), 'cloud browser bundle must load');
assert(index.includes('cloud-browser/cloud-v2-auth-fix.browser.js'), 'browser-bundled registration guard must load');
assert(index.indexOf('v120.js') < index.indexOf('cloud-browser/cloud-v2.browser.js'), 'cloud layer must load after stable renderer');
assert(index.indexOf('cloud-v2.browser.js') < index.indexOf('cloud-v2-auth-fix.browser.js'), 'auth guard must load after cloud layer');
assert(!cloudBrowser.includes("require('firebase/") && !cloudBrowser.includes('require("firebase/'), 'runtime Firebase require must not remain in browser bundle');
assert(!authBrowser.includes("require('firebase/") && !authBrowser.includes('require("firebase/'), 'runtime Firebase auth require must not remain in browser bundle');
assert(cloud.includes('createUserWithEmailAndPassword'), 'account creation missing');
assert(cloud.includes('sendEmailVerification'), 'email verification missing');
assert(authFix.includes('stopImmediatePropagation'), 'registration guard must replace legacy submit flow');
assert(authFix.includes('sendEmailVerification') && !authFix.includes("setDoc(doc(db, 'users'"), 'registration must verify email before Firestore profile write');
assert(cloud.includes('browserLocalPersistence'), 'persistent auth session missing');
assert(cloud.includes('persistentLocalCache'), 'Firestore offline cache missing');
assert(cloud.includes('onDisconnect'), 'presence disconnect handling missing');
assert(cloud.includes('createServer') && cloud.includes('sendChannelMessage') && cloud.includes('sendDM'), 'cloud data APIs incomplete');
assert(!configSource.includes('private_key') && !configSource.includes('serviceAccount'), 'Firebase admin credentials must never be packaged');
assert(configSource.includes('banana-cord.firebaseapp.com') || configSource.includes("authDomain: ''"), 'Firebase authDomain must be injected or remain a clean template');
assert(configSource.includes('https://banana-cord-default-rtdb.firebaseio.com'), 'Realtime Database URL missing from build config');
assert(firestoreRules.includes('email_verified') && firestoreRules.includes('dmThreads'), 'Firestore security rules incomplete');
assert(databaseRules.includes('email_verified') && databaseRules.includes('presence'), 'Realtime Database rules incomplete');
console.log(`Banana Cord ${pkg.version} cloud browser foundation smoke test: OK`);
