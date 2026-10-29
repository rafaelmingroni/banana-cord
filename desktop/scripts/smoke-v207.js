const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const voice = fs.readFileSync(path.join(root, 'src', 'v207-voice-stream-fix.js'), 'utf8');
const social = fs.readFileSync(path.join(root, 'src', 'v207-social-fix.js'), 'utf8');
const socialUi = fs.readFileSync(path.join(root, 'src', 'v207-social-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(voice);
new Function(social);
new Function(socialUi);

assert.strictEqual(pkg.version, '2.0.7', 'V2.0.7 package version must be set.');
assert(index.includes('v207-social-fix.js'), 'Index must load V2.0.7 social backend fix.');
assert(index.includes('v207-social-ui-fix.js'), 'Index must load V2.0.7 social UI fix.');
assert(index.includes('v207-voice-stream-fix.js'), 'Index must load V2.0.7 voice/stream fix.');

// Social permission/onboarding regressions.
assert(social.includes("where('participants', 'array-contains', this.user.uid)"), 'Relationship lookup must use a rule-compatible query.');
assert(!social.includes('Vocês precisam estar em um servidor em comum'), 'Friend requests must not require a shared server.');
assert(social.includes("collection(this.db, 'publicProfiles')"), 'Friend search must use public profiles.');
assert(social.includes("doc(this.db, 'dmThreads', tid)"), 'A first DM must create its parent thread before watching messages.');
assert(socialUi.includes('Adicionar amigo'), 'Onboarding must expose Add friend clearly.');
assert(socialUi.includes('Criar ou entrar em um servidor'), 'Onboarding must expose server creation/join clearly.');
assert(socialUi.includes('Não é preciso estar no mesmo servidor'), 'Friend search must explain that a shared server is unnecessary.');
assert(socialUi.includes('Banana Cloud'), 'Legacy host copy must be replaced by Banana Cloud wording.');

// Stream UX and exact identity rules.
assert(voice.includes('▶ Assistir transmissão'), 'Voice list/profile must expose Watch stream.');
assert(voice.includes('socketId === state.socket?.id'), 'Remote cards must reject the current local socket.');
assert(voice.includes('peer.user?.id === localUid'), 'Remote cards must reject the local authenticated UID.');
assert(voice.includes('dedupeServerTree'), 'Voice state must dedupe one account globally across server voice channels.');
assert(voice.includes('directoryLocation'), 'Media events must resolve the real server from the socket directory.');
assert(voice.includes('snapshotsByServer'), 'Voice presence must be cached per server while browsing elsewhere.');

// Execute the V2.0.7 voice compatibility layer with a controlled fake socket.
const processed = [];
const received = [];
const fakeSocket = {
  id: 'selfCurrent',
  user: { uid: 'me' },
  rtdb: {},
  voice: null,
  processVoiceServer(serverId, tree) { processed.push({ serverId, tree }); },
  receive(event, payload) { received.push({ event, payload }); },
  async joinVoice() {},
  async loadServer() { return { channels: [{ id: 'voiceB', type: 'voice', name: 'Geral' }] }; },
  async leaveVoice() { this.voice = null; },
  async publicUser(uid) { return { id: uid, name: uid === 'me' ? 'Eu' : 'Amigo' }; }
};

const fakeState = {
  user: { id: 'me' },
  socket: fakeSocket,
  servers: [
    { id: 'server', channels: [{ id: 'voiceB', type: 'voice', name: 'Geral' }] },
    { id: 'other', channels: [{ id: 'text', type: 'text', name: 'chat' }] }
  ],
  selectedServer: { id: 'server', channels: [{ id: 'voiceB', type: 'voice', name: 'Geral' }] },
  selectedChannel: null,
  voicePresence: new Map(),
  voice: { serverId: null, channelId: null, peers: new Map() },
  ui: { focusSharing: false, showAllOverride: false }
};

const fakeWindow = { BananaCloudSocket: fakeSocket, BananaLegacy: null };
const fakeDocument = {
  head: { appendChild() {} },
  createElement() { return { textContent: '', className: '', style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} }; },
  getElementById() { return null; },
  querySelector() { return null; }
};
const mockRequire = name => {
  if (name !== 'firebase/database') throw new Error(`Unexpected require: ${name}`);
  return {
    ref: (_db, dbPath) => ({ path: dbPath }),
    get: async () => ({ val: () => ({}) }),
    remove: async () => {},
    set: async () => {},
    onDisconnect: () => ({ remove: async () => {} }),
    serverTimestamp: () => Date.now()
  };
};

const runVoice = new Function(
  'window', 'state', 'removePeer', 'addRemoteCard', 'handleSignal', 'selectServer',
  'renderChannels', 'leaveVoice', 'toast', 'renderVoiceUsers', 'openMemberProfile',
  'document', 'joinVoice', 'selectChannel', 'applyFocusSharing', 'closeModal',
  'confirm', 'setTimeout', 'require', voice
);

runVoice(
  fakeWindow,
  fakeState,
  () => {},
  () => {},
  async () => {},
  () => {},
  () => {},
  async () => {},
  () => {},
  () => {},
  () => {},
  fakeDocument,
  async () => {},
  () => {},
  () => {},
  () => {},
  () => true,
  () => 0,
  mockRequire
);

const duplicatedTree = {
  voiceA: {
    selfOld: { userId: 'me', user: { id: 'me', name: 'Eu velho' }, joinedAt: 10, mediaState: { screen: false } },
    friendOld: { userId: 'friend', user: { id: 'friend', name: 'Amigo' }, joinedAt: 20, mediaState: { screen: false } }
  },
  voiceB: {
    selfCurrent: { userId: 'me', user: { id: 'me', name: 'Eu' }, joinedAt: 30, mediaState: { screen: false } },
    friendNew: { userId: 'friend', user: { id: 'friend', name: 'Amigo' }, joinedAt: 40, mediaState: { screen: true } }
  }
};

fakeSocket.processVoiceServer('server', duplicatedTree);
assert.strictEqual(processed.length, 1, 'Voice tree must reach the underlying processor once.');
const cleanTree = processed[0].tree;
const allClean = Object.values(cleanTree).flatMap(group => Object.entries(group || {}));
assert.strictEqual(allClean.filter(([, row]) => row.userId === 'me').length, 1, 'The same local account must never appear twice.');
assert.strictEqual(allClean.find(([, row]) => row.userId === 'me')[0], 'selfCurrent', 'Current local socket must win over a stale self session.');
assert.strictEqual(allClean.filter(([, row]) => row.userId === 'friend').length, 1, 'A remote account must have only one session across voice channels.');
assert.strictEqual(allClean.find(([, row]) => row.userId === 'friend')[0], 'friendNew', 'Newest remote session must win globally.');

fakeSocket.receive('voice:peers', {
  channelId: 'voiceB',
  peers: [
    { socketId: 'selfOld', user: { id: 'me', name: 'Eu velho' } },
    { socketId: 'friendOld', user: { id: 'friend', name: 'Amigo' } },
    { socketId: 'friendNew', user: { id: 'friend', name: 'Amigo' } }
  ]
});
const peerEvent = received.find(row => row.event === 'voice:peers');
assert(peerEvent, 'Initial peers event must still be delivered.');
assert.strictEqual(peerEvent.payload.peers.length, 1, 'Self and duplicate remote peers must be filtered.');
assert.strictEqual(peerEvent.payload.peers[0].socketId, 'friendNew', 'The authoritative newest remote socket must be retained.');

fakeSocket.receive('voice:snapshot', {
  serverId: 'server',
  entries: [
    { channelId: 'voiceB', socketId: 'selfCurrent', userId: 'me', user: { id: 'me', name: 'Eu' }, joinedAt: 30, mediaState: { screen: false } },
    { channelId: 'voiceB', socketId: 'friendNew', userId: 'friend', user: { id: 'friend', name: 'Amigo' }, joinedAt: 40, mediaState: { screen: true } }
  ]
});
let cachedFriend = fakeWindow.BananaVoiceSnapshotsByServer.get('server').find(e => e.userId === 'friend');
assert.strictEqual(cachedFriend.mediaState.screen, true, 'Friend screen share must initially belong to the friend socket.');

// Browse another server while the call remains active. Media updates must still target
// the server that owns the socket, not whichever server is visible in the UI.
fakeState.selectedServer = { id: 'other', channels: [{ id: 'text', type: 'text', name: 'chat' }] };
fakeSocket.receive('voice:media-state-global', {
  socketId: 'friendOld', userId: 'friend', channelId: 'voiceB', mediaState: { screen: false }
});
cachedFriend = fakeWindow.BananaVoiceSnapshotsByServer.get('server').find(e => e.userId === 'friend');
assert.strictEqual(cachedFriend.mediaState.screen, true, 'A stale socket event must not steal or clear another participant screen-share state.');

fakeSocket.receive('voice:media-state-global', {
  socketId: 'friendNew', userId: 'friend', channelId: 'voiceB', mediaState: { screen: false }
});
cachedFriend = fakeWindow.BananaVoiceSnapshotsByServer.get('server').find(e => e.userId === 'friend');
assert.strictEqual(cachedFriend.mediaState.screen, false, 'Exact socket media events must update the correct server even while browsing elsewhere.');

console.log('Banana Cord V2.0.7 social/voice/stream regression checks: OK');
