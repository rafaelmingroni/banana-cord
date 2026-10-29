const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const graceful = fs.readFileSync(path.join(root, 'graceful-shutdown.js'), 'utf8');
const updater = fs.readFileSync(path.join(root, 'updater-prompt.js'), 'utf8');
const tray = fs.readFileSync(path.join(root, 'tray.js'), 'utf8');
const callFix = fs.readFileSync(path.join(root, 'src', 'v206-call-update-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(callFix);
new Function(graceful);

assert.strictEqual(pkg.version, '2.0.6', 'Critical restart fix must ship as 2.0.6.');
assert(pkg.build.files.includes('graceful-shutdown.js'), 'Installer must include graceful-shutdown.js.');

assert(graceful.includes('window.BananaCloudSocket?.disconnect'), 'Updater shutdown must explicitly disconnect Banana Cloud.');
assert(graceful.includes('await prepareRendererShutdown()'), 'quitAndInstall wrapper must wait for renderer cleanup.');
assert(graceful.includes('originalQuitAndInstall'), 'Wrapped updater must still invoke the real installer restart.');
assert(updater.includes('patchAutoUpdater(autoUpdater)'), 'Updater prompt must use the graceful quitAndInstall wrapper.');
assert(tray.includes('await prepareRendererShutdown()'), 'Tray exit must also clean the Cloud voice session.');

assert(callFix.includes('dedupeVoiceTree'), 'Voice snapshots must be deduplicated after an updater restart.');
assert(callFix.includes('dedupePeers'), 'Initial voice peer list must be deduplicated.');
assert(callFix.includes('session?.userId === this.user.uid'), 'Joining voice must detect stale sessions from the same account.');
assert(callFix.includes("remove(ref(this.rtdb, `voiceRooms/${payload.serverId}/${channelId}/${socketId}`))"), 'Stale own voice sessions must be removed from Realtime Database.');
assert(callFix.includes('newestByUser'), 'When duplicate sessions exist, the newest session per user must win.');
assert(index.includes('v206-call-update-fix.js'), 'Renderer must load the V2.0.6 call/update guard.');

(async () => {
  const removed = [];
  const tree = {
    voice: {
      staleSelf: { userId: 'me', user: { id: 'me', name: 'Eu' }, joinedAt: 10 },
      friendOld: { userId: 'friend', user: { id: 'friend', name: 'Amigo' }, joinedAt: 20 },
      friendNew: { userId: 'friend', user: { id: 'friend', name: 'Amigo' }, joinedAt: 30 }
    }
  };

  const fakeSocket = {
    id: 'currentSession',
    user: { uid: 'me' },
    rtdb: {},
    processedTree: null,
    received: null,
    joined: false,
    processVoiceServer(_serverId, value) { this.processedTree = value; },
    receive(event, payload) { this.received = { event, payload }; },
    async joinVoice() { this.joined = true; }
  };

  const fakeWindow = { BananaCloudSocket: fakeSocket, BananaLegacy: null };
  const mockRequire = name => {
    if (name !== 'firebase/database') throw new Error(`Unexpected require: ${name}`);
    return {
      ref: (_db, dbPath) => ({ path: dbPath }),
      get: async () => ({ val: () => tree }),
      remove: async target => { removed.push(target.path); }
    };
  };

  new Function('window', 'require', callFix)(fakeWindow, mockRequire);

  fakeSocket.processVoiceServer('server', tree);
  const dedupedSessions = Object.entries(fakeSocket.processedTree.voice);
  assert.strictEqual(dedupedSessions.filter(([, row]) => row.userId === 'friend').length, 1, 'Duplicate friend sessions must collapse to one voice session.');
  assert.strictEqual(dedupedSessions.find(([, row]) => row.userId === 'friend')[0], 'friendNew', 'Newest duplicate voice session must win.');

  fakeSocket.receive('voice:peers', {
    peers: [
      { socketId: 'friendOld', user: { id: 'friend', name: 'Amigo' } },
      { socketId: 'friendNew', user: { id: 'friend', name: 'Amigo' } }
    ]
  });
  assert.strictEqual(fakeSocket.received.payload.peers.length, 1, 'Initial peer list must not render the same account twice.');
  assert.strictEqual(fakeSocket.received.payload.peers[0].socketId, 'friendNew', 'Latest peer entry must be retained.');

  await fakeSocket.joinVoice({ serverId: 'server', channelId: 'voice' });
  assert(fakeSocket.joined, 'Original joinVoice must still run after stale-session cleanup.');
  assert(removed.includes('voiceRooms/server/voice/staleSelf'), 'A stale session belonging to the same account must be removed before joining.');

  console.log('Banana Cord V2.0.6 call/update restart regression checks: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
