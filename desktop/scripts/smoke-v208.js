const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const hotfix = fs.readFileSync(path.join(root, 'src', 'v208-call-hotfix.js'), 'utf8');
const social = fs.readFileSync(path.join(root, 'src', 'v207-social-fix.js'), 'utf8');
const socialUi = fs.readFileSync(path.join(root, 'src', 'v207-social-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(hotfix);
assert.strictEqual(pkg.version, '2.0.8', 'V2.0.8 package version must be set.');
assert(index.includes('v208-call-hotfix.js'), 'Renderer must load the V2.0.8 call hotfix.');
assert(index.indexOf('v208-call-hotfix.js') > index.indexOf('v207-voice-stream-fix.js'), 'V2.0.8 must load after V2.0.7 so it can block the broken transport wrapper.');
assert(!hotfix.includes("require('firebase/database')"), 'V2.0.8 must never load a second Firebase Database SDK in the voice hotfix.');
assert(hotfix.includes('__bananaV206CallUpdatePatched = true'), 'V2.0.8 must block the old V2.0.6 Firebase transport wrapper.');
assert(hotfix.includes('__bananaV207VoiceStreamPatched = true'), 'V2.0.8 must block the broken V2.0.7 Firebase transport wrapper.');
assert(hotfix.includes('avatarStyle(avatar, user)'), 'Local voice card must use the signed-in profile avatar.');
assert(hotfix.includes("button.textContent = '▶ Assistir transmissão'"), 'Voice sidebar must expose Watch stream.');

// Keep V2.0.7 social fixes while replacing only its voice transport patch.
assert(social.includes("where('participants', 'array-contains', this.user.uid)"), 'Friend relationship query must remain rule-compatible.');
assert(social.includes("collection(this.db, 'publicProfiles')"), 'Friend search must remain available.');
assert(socialUi.includes('Adicionar amigo'), 'Social onboarding must remain available.');

const processed = [];
const received = [];
const fakeSocket = {
  id: 'selfCurrent',
  user: { uid: 'me' },
  processVoiceServer(serverId, tree) { processed.push({ serverId, tree }); },
  receive(event, payload) { received.push({ event, payload }); }
};
const state = {
  user: { id: 'me', name: 'Mingrx', avatar: 'avatar-data' },
  socket: fakeSocket,
  servers: [], selectedServer: null, selectedChannel: null,
  voicePresence: new Map(),
  voice: { serverId: null, channelId: null, peers: new Map(), screen: null, muted: false },
  ui: { focusSharing: false, showAllOverride: false }
};
let attachObserved = null;
const fakeWindow = {
  BananaCloudSocket: null,
  BananaLegacy: {
    attachSocket(socket) {
      attachObserved = {
        v206Blocked: socket.__bananaV206CallUpdatePatched,
        v207Blocked: socket.__bananaV207VoiceStreamPatched,
        v208Patched: socket.__bananaV208Patched
      };
    }
  }
};
const fakeDocument = {
  head: { appendChild() {} },
  createElement() { return { textContent: '', style: {}, className: '', classList: { add() {}, remove() {} }, addEventListener() {}, querySelectorAll() { return []; } }; },
  getElementById() { return null; }
};

const run = new Function(
  'window','state','removePeer','addLocalCard','updateLocalVideo','renderVoiceUsers','document','avatarStyle',
  'toast','selectServer','selectChannel','joinVoice','applyFocusSharing','confirm','setTimeout', hotfix
);
run(
  fakeWindow, state, () => {}, () => {}, () => {}, () => {}, fakeDocument, () => {},
  () => {}, () => {}, () => {}, async () => {}, () => {}, () => true, () => 0
);

fakeWindow.BananaLegacy.attachSocket(fakeSocket, {});
assert.deepStrictEqual(attachObserved, { v206Blocked: true, v207Blocked: true, v208Patched: true }, 'V2.0.8 must patch first and block both old Firebase transport wrappers.');

const duplicatedTree = {
  oldChannel: {
    selfOld: { userId: 'me', user: { id: 'me', name: 'Mingrx velho' }, joinedAt: 10 },
    friendOld: { userId: 'friend', user: { id: 'friend', name: 'Gustavo Pioto' }, joinedAt: 20, mediaState: { screen: false } }
  },
  general: {
    selfCurrent: { userId: 'me', user: { id: 'me', name: 'Mingrx' }, joinedAt: 30 },
    friendNew: { userId: 'friend', user: { id: 'friend', name: 'Gustavo Pioto' }, joinedAt: 40, mediaState: { screen: true } }
  }
};
fakeSocket.processVoiceServer('server', duplicatedTree);
assert.strictEqual(processed.length, 1, 'Underlying Cloud processor must receive one deduplicated tree.');
const cleanRows = Object.values(processed[0].tree).flatMap(group => Object.entries(group || {}));
assert.strictEqual(cleanRows.filter(([, row]) => row.userId === 'me').length, 1, 'Only the current Mingrx session may remain.');
assert.strictEqual(cleanRows.find(([, row]) => row.userId === 'me')[0], 'selfCurrent', 'Current local socket must win.');
assert.strictEqual(cleanRows.filter(([, row]) => row.userId === 'friend').length, 1, 'Gustavo must appear only once.');
assert.strictEqual(cleanRows.find(([, row]) => row.userId === 'friend')[0], 'friendNew', 'Newest Gustavo session must win.');

fakeSocket.receive('voice:peers', {
  channelId: 'general',
  peers: [
    { socketId: 'selfOld', user: { id: 'me', name: 'Mingrx velho' } },
    { socketId: 'friendOld', user: { id: 'friend', name: 'Gustavo Pioto' } },
    { socketId: 'friendNew', user: { id: 'friend', name: 'Gustavo Pioto' } }
  ]
});
const peers = received.find(row => row.event === 'voice:peers')?.payload?.peers || [];
assert.strictEqual(peers.length, 1, 'Initial peer list must remove self and duplicate friend sessions.');
assert.strictEqual(peers[0].socketId, 'friendNew', 'Initial peer list must keep Gustavo authoritative socket.');

console.log('Banana Cord V2.0.8 restored voice transport regression checks: OK');
