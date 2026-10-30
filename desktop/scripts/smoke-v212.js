const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const cloudFix = fs.readFileSync(path.join(root, 'src', 'cloud-v2-v212-fix.js'), 'utf8');
const uiFix = fs.readFileSync(path.join(root, 'src', 'v212-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'scripts', 'build-cloud-browser.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(cloudFix);
new Function(uiFix);

assert(builder.includes("require('./cloud-v2-v212-fix.js')"), 'V2.0.12 Cloud fix must be inside the single Firebase browser bundle.');
assert(index.includes('<script src="v212-ui-fix.js"></script>'), 'V2.0.12 UI fix must load after compatibility patches.');
assert(uiFix.includes('shell.openExternal'), 'Message links must open with Electron shell.openExternal.');
assert(uiFix.includes("addEventListener('dblclick'"), 'Voice channels must support double-click join.');
assert(uiFix.includes('state.selectedServer = null'), 'Private navigation must detach the selected server.');
assert(uiFix.includes('directUserId'), 'Private voice call must join a direct peer.');
assert(uiFix.includes('Seu cargo não permite entrar nessa sala de voz.'), 'UI must block restricted voice rooms before microphone capture.');
assert(cloudFix.includes('`voiceRooms/${roomKey}/direct`'), 'Private calls must use an isolated direct room inside the existing voice transport.');
assert(cloudFix.includes('roleCanAccessChannel'), 'Cloud socket must enforce role hierarchy.');
assert(cloudFix.includes('socket.loadServer = async function loadServerV212'), 'Server channel visibility must use the V2.0.12 hierarchy.');
assert(cloudFix.includes('socket.joinVoice = async function joinVoiceV212'), 'Voice join must be authoritatively permission-checked.');
assert(cloudFix.includes("event === 'dm:call:start'"), 'Cloud socket must expose private-call start.');
assert(cloudFix.includes("event === 'dm:call:end'"), 'Cloud socket must expose private-call end.');

const [major, minor, patch] = String(pkg.version || '').split('.').map(Number);
assert(major === 2 && (minor > 0 || patch >= 12), 'V2.0.12 regression requires version 2.0.12 or newer.');

console.log(`Banana Cord ${pkg.version} links/private navigation/voice hierarchy/private-call regression checks: OK`);
