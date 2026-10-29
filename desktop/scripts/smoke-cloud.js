const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'src', 'cloud-v2.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'cloud', 'firebase-config.js'), 'utf8');
const firestoreRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const databaseRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'database.rules.json'), 'utf8');

function assert(ok, message) {
  if (!ok) {
    console.error(`Cloud smoke test failed: ${message}`);
    process.exit(1);
  }
}

execFileSync(process.execPath, ['--check', path.join(root, 'src', 'cloud-v2.js')], { stdio: 'inherit' });
assert(/^2\.0\.0-cloud\./.test(pkg.version), 'preview version must use 2.0.0-cloud.x');
assert(pkg.dependencies?.firebase === '12.19.0', 'Firebase JS SDK must be pinned to 12.19.0');
assert((pkg.build?.files || []).includes('cloud/**/*'), 'cloud config folder must be packaged');
assert(index.includes('cloud-v2.css') && index.includes('cloud-v2.js'), 'cloud UI assets must load');
assert(index.indexOf('v120.js') < index.indexOf('cloud-v2.js'), 'cloud layer must load after stable renderer');
assert(cloud.includes('createUserWithEmailAndPassword'), 'account creation missing');
assert(cloud.includes('sendEmailVerification'), 'email verification missing');
assert(cloud.includes('browserLocalPersistence'), 'persistent auth session missing');
assert(cloud.includes('persistentLocalCache'), 'Firestore offline cache missing');
assert(cloud.includes('onDisconnect'), 'presence disconnect handling missing');
assert(cloud.includes('createServer') && cloud.includes('sendChannelMessage') && cloud.includes('sendDM'), 'cloud data APIs incomplete');
assert(config.includes("apiKey: ''") && config.includes("projectId: ''"), 'Firebase config template must not contain private project credentials');
assert(firestoreRules.includes('email_verified') && firestoreRules.includes('dmThreads'), 'Firestore security rules incomplete');
assert(databaseRules.includes('email_verified') && databaseRules.includes('presence'), 'Realtime Database rules incomplete');
console.log(`Banana Cord ${pkg.version} cloud foundation smoke test: OK`);
