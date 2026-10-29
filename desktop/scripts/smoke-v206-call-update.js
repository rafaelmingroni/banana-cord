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

console.log('Banana Cord V2.0.6 call/update restart regression checks: OK');
