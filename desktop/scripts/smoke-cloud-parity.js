const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const mode = fs.readFileSync(path.join(root, 'src', 'cloud-v2-mode.js'), 'utf8');
const socket = fs.readFileSync(path.join(root, 'src', 'cloud-v2-socket.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src', 'cloud-v2-legacy-bridge.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const v1 = fs.readFileSync(path.join(root, 'src', 'v1.js'), 'utf8');
const v110 = fs.readFileSync(path.join(root, 'src', 'v110.js'), 'utf8');
const v120 = fs.readFileSync(path.join(root, 'src', 'v120.js'), 'utf8');
const firestoreRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const databaseRules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'database.rules.json'), 'utf8');

function assert(ok, message) {
  if (!ok) { console.error(`V2 parity smoke test failed: ${message}`); process.exit(1); }
}

for (const file of ['src/cloud-v2-mode.js', 'src/cloud-v2-socket.js', 'src/cloud-v2-legacy-bridge.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

// V2 is login-first. The legacy connection shell may exist only as hidden DOM compatibility.
assert(index.includes('id="setup" class="setup hidden"'), 'legacy setup shell must start hidden in V2');
assert(!index.includes('Hospedar meu Banana Cord'), 'V2 must never expose a hosting button');
assert(index.includes('cloud-v2-mode.js'), 'native cloud mode bootstrap missing');
assert(index.indexOf('cloud-v2-mode.js') < index.indexOf('app.js'), 'cloud mode must be defined before stable renderer starts');
assert(mode.includes('BananaCloudMode = true') && mode.includes('BananaCloudNative = true'), 'V2 native cloud flags missing');

assert(index.includes('cloud-v2-legacy-bridge.js'), 'stable UI cloud bridge must be loaded');
assert(index.includes('cloud-browser/cloud-v2-all.browser.js'), 'single cloud runtime bundle must be loaded');
assert(!index.includes('cloud-browser/cloud-v2-socket.browser.js'), 'legacy split socket bundle must not be loaded');
assert(!index.includes('cloud-v2-home.js'), 'simplified cloud home must not replace the stable app UI');
assert(index.indexOf('v1.js') < index.indexOf('cloud-v2-legacy-bridge.js'), 'bridge must load after stable v1 renderer');
assert(index.indexOf('cloud-v2-legacy-bridge.js') < index.indexOf('v110.js'), 'cloud mode must exist before invite enhancements');
assert(bridge.includes('state.socket = socket') && bridge.includes('bindSocket(socket)'), 'bridge must attach cloud transport to the stable renderer');
assert(!bridge.includes("addServerBtn?.addEventListener('click'"), 'bridge must not compete with stable + server click handler');
assert(bridge.includes('Crie um servidor permanente no Banana Cloud'), 'server modal must explain permanent cloud servers');
assert(bridge.includes('As mensagens ficam sincronizadas no Banana Cloud.'), 'DM empty state must not mention a host PC');

// Stable UI remains responsible for the same controls users already know.
assert(app.includes('els.addServerBtn.addEventListener'), 'stable + server handler missing');
assert(app.includes("state.socket.emit('server:create'"), 'stable create-server button must emit server:create');
assert(app.includes("state.socket.emit('server:join'"), 'stable join-server button must emit server:join');

const clientEvents = [
  'profile:update','social:get','friend:request','friend:accept','friend:reject','friend:remove','friend:block','friend:unblock',
  'server:create','server:join','server:update','server:delete','server:leave','server:regenerate-invite','invite:create-temporary',
  'member:set-role','member:kick','members:get','category:create','category:update','channel:create','channel:update','channel:reorder',
  'messages:load','message:send','message:edit','message:delete','message:react',
  'dm:conversations:get','dm:load','dm:send','dm:edit','dm:delete','dm:react',
  'voice:join','voice:leave','voice:media-state','voice:speaking','webrtc:signal','latency:ping'
];
for (const event of clientEvents) assert(socket.includes(`case '${event}'`), `Cloud socket missing protocol event ${event}`);

const incomingEvents = [
  'auth:ready','app:error','profile:updated','server:created','server:joined','server:removed','server:updated','members:list','presence:update',
  'social:state','voice:snapshot','voice:speaking-global','voice:media-state-global','voice:presence-event','messages:list','message:new','message:updated','message:deleted',
  'dm:conversations','dm:list','dm:new','dm:updated','dm:deleted','voice:full','voice:peers','voice:user-joined','voice:user-left','voice:media-state','voice:speaking','webrtc:signal'
];
for (const event of incomingEvents) assert(socket.includes(`'${event}'`) || socket.includes(`"${event}"`), `Cloud socket missing incoming event ${event}`);

for (const marker of ['voiceRooms/', 'signals/', 'sessionOwners/', "'relationships'", "'dmThreads'", "'invites'", "'servers'"]) {
  assert(socket.includes(marker), `Cloud backend marker missing: ${marker}`);
}

assert(app.includes('getDisplayMedia') && app.includes('createPeer') && app.includes('switchMicrophoneInCall'), 'stable WebRTC/media engine must remain present');
assert(app.includes('screenQuality') && app.includes('screenFps'), 'screen share quality controls must remain present');
assert(v1.includes("friend:request") && v1.includes("message:edit") && v1.includes("category:create"), 'v1 social/message/channel features must remain present');
assert(v110.includes('BananaCloudMode') && v110.includes('invite:create-temporary'), 'premium invite UI must support cloud');
assert(v120.includes('BananaPendingInvite') && v120.includes("server:join"), 'deep links must route into Banana Cloud');

for (const required of ['publicProfiles', 'relationships', 'invites', 'dmThreads', 'email_verified']) assert(firestoreRules.includes(required), `Firestore rules missing ${required}`);
for (const required of ['presence', 'sessionOwners', 'voiceRooms', 'signals', 'email_verified']) assert(databaseRules.includes(required), `Realtime Database rules missing ${required}`);

console.log('Banana Cord V2 native Cloud + full v1.2.1 protocol parity smoke test: OK');
