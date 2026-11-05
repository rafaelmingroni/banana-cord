const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const results = [];
async function main() {
  let requestedLimit = 0;
  const api = {
    doc: (...parts) => parts, collection: (...parts) => parts,
    getDoc: async () => ({ exists: () => true }),
    setDoc: async () => {}, serverTimestamp: () => 0,
    query: (...parts) => parts, orderBy: () => null,
    limit: count => { requestedLimit = count; return count; },
    onSnapshot: () => () => {}
  };
  const window = { BananaLegacy: { attachSocket() {} } };
  const state = { socket: null, viewMode: 'server' };
  const context = vm.createContext({ window, state, console, Map, Set, Date, Promise, queueMicrotask,
    require: () => api,
    document: { createElement: () => ({}), head: { appendChild() {} } }
  });
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, 'desktop/src', file), 'utf8'), context, { filename: file });
  const socket = {
    db: {}, user: { uid: 'alice' }, receive() {}, sendMessage: async () => {}, sendDm: async () => {},
    canDm: async () => true, ensureE2EEIdentity: async () => {}, e2eePublicKey: async () => ({}),
    __bananaE2EEReady: true, dmCleanup: new Map(),
    relation: async () => ({ exists: () => true, data: () => ({ status: 'friends', participants: ['alice', 'bob'] }) })
  };
  load('cloud-v2-v220-chat-stability.js');
  window.BananaV220PatchCloudSocket(socket);
  load('mingrx-312-private-fix.js');
  window.Mingrx312.patchDmSocket(socket);
  await socket.watchDm('bob', 120);
  assert.equal(requestedLimit, 60);
  results.push({ id: 'R01', reproduced: true, description: 'watchDm(peer, 120) solicita somente 60 após o wrapper 3.1.2', observedLimit: requestedLimit });
  socket.__bananaDmHistoryCount.set('bob', 60);
  socket.loadOlderDmV220('bob');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(socket.__bananaDmHistoryCount.get('bob'), 60);
  results.push({ id: 'R02', reproduced: true, description: 'loadOlderDmV220 retorna ao limite inicial em vez de avançar', observedLimit: requestedLimit });

  load('cloud-v2-v212-fix.js');
  const clientAllows = window.BananaV212RoleCanAccessChannel('moderator', { allowedRoles: ['member'] });
  const rulesAllow = ['owner', 'admin'].includes('moderator') || ['member'].includes('moderator');
  assert.equal(clientAllows, true);
  assert.equal(rulesAllow, false);
  results.push({ id: 'R03', reproduced: true, description: 'cliente permite moderador em canal restrito a member, regra Firestore usa inclusão exata', clientAllows, rulesAllow });
  const req = createRequire(path.join(root, 'desktop/package.json'));
  const isolatedPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mingrx-sdk-audit-')), 'isolated.cjs');
  req('esbuild').buildSync({
    stdin: { contents: "const { initializeApp }=require('firebase/app'); const { getFirestore }=require('firebase/firestore'); module.exports=getFirestore(initializeApp({projectId:'demo-audit',apiKey:'synthetic',appId:'synthetic'}));", resolveDir: path.join(root, 'desktop') },
    bundle: true, platform: 'browser', format: 'cjs', outfile: isolatedPath, logLevel: 'silent'
  });
  const isolatedDb = require(isolatedPath);
  let mixedError;
  try { req('firebase/firestore').doc(isolatedDb, 'dmThreads', 'alice_bob'); }
  catch (error) { mixedError = error; }
  assert.equal(mixedError?.code, 'invalid-argument');
  results.push({ id: 'R04', reproduced: true, description: 'doc() do SDK Node rejeita db do SDK empacotado para browser, combinação usada em mingrx-312-private-fix.js e v219-details.js', error: mixedError.message });
  let stopped = false;
  const logoutWindow = { BananaCloud: { signOut: async () => {} }, BananaCloudSocket: { disconnect: async () => {} } };
  const logoutState = { socket: logoutWindow.BananaCloudSocket, dmMessages: new Map([['bob', [{ text: 'DM já descriptografada' }]]]), dmConversations: [{ user: { id: 'bob' } }], voice: { channelId: 'voice', localAudio: { getTracks: () => [{ stop: () => { stopped = true; } }] } } };
  const logoutContext = vm.createContext({ window: logoutWindow, state: logoutState, els: {}, console, Map, Set, Date,
    closeModal() {}, setConnection() {}, toast() {},
    MutationObserver: class { observe() {} }, document: { getElementById: () => null },
    queueMicrotask() {}, setInterval() {}, clearInterval() {}
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'desktop/src/cloud-v2-legacy-bridge.js'), 'utf8'), logoutContext);
  await logoutWindow.BananaLegacy.cloudLogout();
  assert.equal(logoutState.dmMessages.get('bob')[0].text, 'DM já descriptografada');
  assert.equal(logoutState.voice.channelId, 'voice');
  assert.equal(stopped, false);
  results.push({ id: 'R05', reproduced: true, description: 'cloudLogout deixa DMs em memória e não encerra a mídia local; socket simulado sem efeitos de mídia, como disconnect do transporte', plaintextRemains: true, localTrackStopped: stopped });
  const updater = { autoInstallOnAppQuit: false, on() {}, setFeedURL() {} };
  const mainContext = vm.createContext({ console, process, URL, setTimeout, clearTimeout, setImmediate,
    __dirname: path.join(root, 'desktop'),
    require: name => {
      if (name === 'electron') return { app: { on() {}, whenReady: () => ({ then() {} }), getVersion: () => '3.1.4' } };
      if (name === 'electron-updater') return { autoUpdater: updater };
      if (name === './server/server') return {};
      return require(name);
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8'), mainContext);
  vm.runInContext('configureUpdater()', mainContext);
  assert.equal(updater.autoInstallOnAppQuit, true);
  results.push({ id: 'R06', reproduced: true, description: 'configureUpdater do main reativa autoInstallOnAppQuit que updater-prompt havia desativado', autoInstallOnAppQuit: updater.autoInstallOnAppQuit });
  fs.writeFileSync(path.join(__dirname, 'resultado-runtime.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
