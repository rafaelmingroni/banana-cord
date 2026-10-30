const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const nav = fs.readFileSync(path.join(root, 'src', 'v205-navigation-fix.js'), 'utf8');
const legacyDelete = fs.readFileSync(path.join(root, 'src', 'v205-server-delete-fix.js'), 'utf8');
const nativeDelete = fs.readFileSync(path.join(root, 'src', 'cloud-v2-server-delete-fix.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'scripts', 'build-cloud-browser.js'), 'utf8');

new Function(nav);
new Function(legacyDelete);
new Function(nativeDelete);

// Navigation regression from V2.0.5 remains protected.
assert(nav.includes('selectServerV205'), 'V2.0.5 must override server navigation.');
assert(!nav.includes('leaveVoice()'), 'Browsing servers must not leave the active voice call.');
assert(nav.includes("state.socket.emit('members:get'"), 'Navigation must still load the selected server members.');

// V2.0.9 moves server deletion into the single Cloud bundle. The old external
// wrapper must never import Firestore again, because its db reference was created
// by a different bundled Firebase runtime.
assert(!legacyDelete.includes("require('firebase/firestore')"), 'Legacy server deletion wrapper must not import a second Firestore SDK.');
assert(legacyDelete.includes('__bananaV205ServerDeleteFix'), 'Legacy compatibility marker must remain harmlessly loadable.');
assert(nativeDelete.includes("require('firebase/firestore')"), 'Native deletion patch must use bundled Firestore functions.');
assert(builder.includes("require('./cloud-v2-server-delete-fix.js');"), 'Native deletion patch must be part of the single Cloud bundle.');
assert(builder.indexOf("require('./cloud-v2-server-delete-fix.js');") > builder.indexOf("require('./cloud-v2-socket.js');"), 'Deletion patch must load after the Cloud socket implementation.');

// Execute the bundled patch with a controlled Firestore facade and verify that
// messages/channels are committed before the original member/server cleanup.
const ops = [];
const channelDocs = [
  { id: 'text', ref: { path: 'servers/srv/channels/text' }, data: () => ({ type: 'text' }) },
  { id: 'voice', ref: { path: 'servers/srv/channels/voice' }, data: () => ({ type: 'voice' }) }
];
const messageDocs = [
  { ref: { path: 'servers/srv/channels/text/messages/m1' } },
  { ref: { path: 'servers/srv/channels/text/messages/m2' } }
];
const collection = (_db, ...parts) => ({ path: parts.join('/') });
const getDocs = async ref => {
  if (ref.path === 'servers/srv/channels') return { docs: channelDocs };
  if (ref.path === 'servers/srv/channels/text/messages') return { docs: messageDocs };
  throw new Error(`Unexpected collection ${ref.path}`);
};
const writeBatch = () => {
  const pending = [];
  return {
    delete(ref) { pending.push(ref.path); },
    async commit() { ops.push(...pending.map(path => `delete:${path}`), 'commit'); }
  };
};
const mockRequire = name => {
  if (name !== 'firebase/firestore') throw new Error(`Unexpected require ${name}`);
  return { collection, getDocs, writeBatch };
};
let attachObserved = null;
const fakeWindow = {
  BananaCloudSocket: null,
  BananaLegacy: {
    attachSocket(socket) { attachObserved = socket; }
  }
};
const fakeSocket = {
  db: {},
  async role() { return 'owner'; },
  async deleteServer() { ops.push('original-deleteServer'); }
};
new Function('window', 'require', nativeDelete)(fakeWindow, mockRequire);
fakeWindow.BananaLegacy.attachSocket(fakeSocket, {});
assert.strictEqual(attachObserved, fakeSocket, 'Patched socket must still be passed to the legacy UI.');

(async () => {
  await fakeSocket.deleteServer('srv');
  const originalAt = ops.indexOf('original-deleteServer');
  const textChannelAt = ops.indexOf('delete:servers/srv/channels/text');
  const voiceChannelAt = ops.indexOf('delete:servers/srv/channels/voice');
  const lastMessageAt = ops.indexOf('delete:servers/srv/channels/text/messages/m2');
  assert(lastMessageAt >= 0, 'Text messages must be deleted.');
  assert(textChannelAt > lastMessageAt && voiceChannelAt > lastMessageAt, 'Channels must be deleted only after text messages.');
  assert(originalAt > textChannelAt && originalAt > voiceChannelAt, 'Member/server cleanup must run only after every channel is gone.');
  console.log('Banana Cord V2.0.9 native server deletion regression checks: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
