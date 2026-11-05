const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const main = read('main.js');
const updaterPrompt = read('update-service.js');
const updaterCompat = read('src/mingrx-updater-compat.js');
const index = read('src/index.html');
const cloud = read('src/cloud-v2-v215-security-fix.js');
const ui = read('src/v215-security-ui-fix.js');
const firestore = fs.readFileSync(path.join(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const databaseText = fs.readFileSync(path.join(root, '..', 'firebase', 'database.rules.json'), 'utf8');
const database = JSON.parse(databaseText);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(main.includes("require('./update-service')"), 'Window must delegate to the single updater service.');
expect(main.includes('nodeIntegration: false') && main.includes('contextIsolation: true') && main.includes('sandbox: true'), 'Renderer isolation is required.');
expect(updaterPrompt.includes("require('./src/mingrx-updater-compat')"), 'Mingrx updater compatibility layer must load before the legacy updater code.');
expect(updaterCompat.includes("const OFFICIAL_UPDATE_REPO = 'mingrx-app'"), 'Official Mingrx updater repository must be mingrx-app.');
expect(updaterCompat.includes("LEGACY_UPDATE_REPOS = new Set(['banana-cord', 'mingrx'])"), 'Legacy updater repository names must be rewritten safely.');
expect(ui.includes("const OFFICIAL_REPO = 'https://github.com/rafaelmingroni/mingrx-app'"), 'Renderer updater source must be pinned to mingrx-app.');
expect(main.includes('setWindowOpenHandler'), 'Electron popup hardening is missing.');
expect(main.includes('will-navigate'), 'Electron navigation guard is missing.');
expect(main.includes('will-attach-webview'), 'Electron webview guard is missing.');
expect(main.includes('nodeIntegrationInWorker: false'), 'Node must be disabled in workers.');
expect(main.includes('nodeIntegrationInSubFrames: false'), 'Node must be disabled in subframes.');
expect(main.includes('webviewTag: false'), 'webviewTag must stay disabled.');
expect(main.includes('devTools: !app.isPackaged'), 'DevTools must be disabled in production builds.');
expect(index.includes("object-src 'none'"), 'CSP must block plugins/objects.');
expect(index.includes("base-uri 'none'"), 'CSP must block base URI injection.');
expect(index.includes('<script src="v215-security-ui-fix.js"></script>'), 'V2.0.15 renderer guard is not loaded.');
expect(ui.includes('OFFICIAL_REPO'), 'Renderer updater source guard is missing.');
expect(cloud.includes('friend-only') || cloud.includes('accepted friendship'), 'Friend-only private communication guard is missing.');
expect(cloud.includes('joinServerV215'), 'Safe invite join flow is missing.');
expect(firestore.includes('allow get: if member(serverId);'), 'Server metadata must be hidden from outsiders.');
expect(firestore.includes('allow list: if false;'), 'Collection enumeration protections are missing.');
expect(firestore.includes("affectedKeys().hasOnly(['text', 'editedAt', 'mentionIds'])"), 'Server message identity immutability guard is missing.');
expect(firestore.includes('friendThread(threadId)'), 'Friend-only DM authorization is missing from Firestore rules.');
expect(database.rules['.read'] === false && database.rules['.write'] === false && Object.keys(database.rules).length===2, 'Every legacy RTDB path must be closed.');

console.log('Mingrx updater/security hardening regression checks: OK');
