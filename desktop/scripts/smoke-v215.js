const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const main = read('main.js');
const index = read('src/index.html');
const cloud = read('src/cloud-v2-v215-security-fix.js');
const ui = read('src/v215-security-ui-fix.js');
const firestore = fs.readFileSync(path.join(root, '..', 'firebase', 'firestore.rules'), 'utf8');
const database = fs.readFileSync(path.join(root, '..', 'firebase', 'database.rules.json'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(main.includes("const DEFAULT_UPDATE_REPO = 'https://github.com/rafaelmingroni/banana-cord'"), 'Official updater source must be pinned.');
expect(main.includes("setWindowOpenHandler"), 'Electron popup hardening is missing.');
expect(main.includes("will-navigate"), 'Electron navigation guard is missing.');
expect(main.includes("will-attach-webview"), 'Electron webview guard is missing.');
expect(main.includes("nodeIntegrationInWorker: false"), 'Node must be disabled in workers.');
expect(main.includes("nodeIntegrationInSubFrames: false"), 'Node must be disabled in subframes.');
expect(main.includes("webviewTag: false"), 'webviewTag must stay disabled.');
expect(main.includes("devTools: !app.isPackaged"), 'DevTools must be disabled in production builds.');
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
expect(database.includes('"signaling": {\n      ".read": false'), 'Legacy RTDB signaling must be closed.');
expect(database.includes('"voiceRooms": {\n      ".read": false'), 'Voice room root enumeration must be blocked.');

console.log('Banana Cord V2.0.15 security hardening regression checks: OK');
