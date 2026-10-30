const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const nativeSocial = fs.readFileSync(path.join(root, 'src', 'cloud-v2-social-fix.js'), 'utf8');
const legacySocial = fs.readFileSync(path.join(root, 'src', 'v207-social-fix.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'scripts', 'build-cloud-browser.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(nativeSocial);
new Function(legacySocial);

assert(builder.includes("require('./cloud-v2-social-fix.js')"), 'V2.0.11 social fix must be inside the single Banana Cloud bundle.');
assert(nativeSocial.includes("require('firebase/firestore')"), 'Native social fix must use Firestore from the bundled runtime.');
assert(!legacySocial.includes("require('firebase/firestore')"), 'Legacy social patch must not create a second Firestore runtime.');
assert(nativeSocial.includes("where('participants', 'array-contains', this.user.uid)"), 'Relationship lookup must query only relationships visible to the signed-in user.');
assert(!nativeSocial.includes("if(!(await this.sharesServer(otherUid)))"), 'Friend requests must not require a shared server.');
assert(nativeSocial.includes("socket.friendRequest = async function friendRequestV211"), 'V2.0.11 must replace friend request logic.');
assert(nativeSocial.includes("socket.watchDm = async function watchDmV211"), 'V2.0.11 must create the DM parent before watching messages.');
assert(nativeSocial.includes("collection(this.db, 'dmThreads'" ) || nativeSocial.includes("doc(this.db, 'dmThreads', tid)"), 'V2.0.11 must create/merge the DM thread parent.');
assert(nativeSocial.includes("event === 'friend:search'"), 'Friend search must remain supported.');
assert(nativeSocial.includes("searchName"), 'Public profiles must maintain a normalized search name.');

const [major, minor, patch] = String(pkg.version || '').split('.').map(Number);
assert(major === 2 && (minor > 0 || patch >= 11), 'V2.0.11 regression must run on version 2.0.11 or newer.');

console.log(`Banana Cord ${pkg.version} social/DM single-runtime regression checks: OK`);
