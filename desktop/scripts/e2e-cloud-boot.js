// Exercise the production auth -> Cloud socket -> visible shell path. The UI
// tests that attach a fake socket cannot detect failures in this startup chain.
// Run inside Firebase emulators:exec with auth (9099) and firestore (8080).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const esbuild = require('esbuild');
const { app, BrowserWindow, ipcMain, session } = require('electron');

const root = path.resolve(__dirname, '..');
const testData = fs.mkdtempSync(path.join(os.tmpdir(), 'mingrx-cloud-boot-'));
const projectId = process.env.GCLOUD_PROJECT || 'demo-banana-cord';
assert(projectId.startsWith('demo-'), 'Cloud boot test requires a demo Firebase project');

function emulator(value, fallback) {
  const url = new URL(`http://${value || fallback}`);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Emulators must use loopback');
  return url;
}
const authUrl = emulator(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const firestoreUrl = emulator(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
app.setPath('userData', testData);
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
// Destroying the final window otherwise invokes Electron's default quit(0)
// before an assertion failure can propagate to the emulator/CI process.
app.on('window-all-closed', () => {});

// Non-auth platform integrations are outside this test. Keep the production
// preload/isolation and the real Firebase SDK, rules, writes and listeners.
const settings = {
  idleSeconds: 0, idleState: 'active', activity: null,
  settings: { shareActivity: true, autoAwayMinutes: 5,
    startup: { supported: true, enabled: false, registered: false } },
  startupLaunch: false
};
const platformHandlers = {
  'banana-v21:get-settings': () => settings,
  'banana-v21:set-settings': () => settings,
  'banana-v21:get-system-languages': () => ['pt-BR'],
  'update:get-config': () => ({ repoUrl: 'https://github.com/rafaelmingroni/mingrx-app', autoCheck: false, autoDownload: false, currentVersion: require('../package.json').version }),
  'update:get-state': () => ({ status: 'idle', phase: 'idle', progress: 0 }),
  'banana-updater:get-state': () => ({ status: 'idle', phase: 'idle', percent: 0 }),
  'banana-updater:get-version': () => require('../package.json').version,
  'banana-updater:check': () => ({ ok: true }),
  'clipboard:write': () => true,
  'ptt:configure': () => ({ ok: true }),
  'rtc:configuration': () => ({ iceServers: [], relayAvailable: false })
};
for (const [name, handler] of Object.entries(platformHandlers)) ipcMain.handle(name, handler);
require('../e2ee-main');

function replaceOnce(source, marker, replacement) {
  assert.equal(source.split(marker).length, 2, `Expected one test endpoint hook: ${marker}`);
  return source.replace(marker, replacement);
}

async function testBundle() {
  // Read the same entry module order as the production builder rather than
  // maintaining a separate list of startup modules in this regression test.
  const builder = fs.readFileSync(path.join(root, 'scripts/build-cloud-browser.js'), 'utf8');
  const entry = builder.match(/contents:\s*\[([\s\S]*?)\]\.join\(/)?.[1];
  assert(entry, 'Production Cloud entry list not found');
  const lines = [...entry.matchAll(/^\s*("(?:\\.|[^"\\])*")\s*,?\s*$/gm)].map(m => JSON.parse(m[1]));
  assert(lines.length > 10, 'Production Cloud entry list incomplete');
  const result = await esbuild.build({
    stdin: { contents: lines.join('\n'), resolveDir: path.join(root, 'src'), sourcefile: 'cloud-boot-test-entry.js' },
    bundle: true, platform: 'browser', format: 'iife', target: ['chrome140'], write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'test-only-firebase-endpoints', setup(build) {
      build.onLoad({ filter: /[\\/]cloud[\\/]firebase-config\.js$/ }, () => ({
        contents: `module.exports=${JSON.stringify({ apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'demo-app-id' })};`, loader: 'js'
      }));
      build.onLoad({ filter: /[\\/]src[\\/]cloud-v2\.js$/ }, args => {
        let source = fs.readFileSync(args.path, 'utf8');
        source = replaceOnce(source, 'const auth = getAuth(firebaseApp);',
          `const auth = getAuth(firebaseApp); require('firebase/auth').connectAuthEmulator(auth, ${JSON.stringify(authUrl.origin)}, {disableWarnings:true});`);
        source = replaceOnce(source, 'const realtime = null;',
          `require('firebase/firestore').connectFirestoreEmulator(db, ${JSON.stringify(firestoreUrl.hostname)}, ${Number(firestoreUrl.port)}); const realtime = null;`);
        return { contents: source, loader: 'js' };
      });
    } }]
  });
  return result.outputFiles[0].contents;
}

async function authRequest(action, data, admin = false) {
  const response = await fetch(`${authUrl.origin}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer owner' } : {}) },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  assert(response.ok, `Auth emulator ${action} failed: ${JSON.stringify(result)}`);
  return result;
}

let win;
let finished = false;
const fatalErrors = [];
const blockedRequests = [];
const hardTimeout = setTimeout(() => finish(1, 'Cloud boot E2E failed: hard timeout'), 90000);
function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(hardTimeout);
  if (message) (code ? console.error : console.log)(message);
  try { win?.destroy(); } catch {}
  try { fs.rmSync(testData, { recursive: true, force: true }); } catch {}
  app.exit(code);
}

async function waitForShell(label) {
  const deadline = Date.now() + 25000;
  let state;
  while (Date.now() < deadline) {
    state = await win.webContents.executeJavaScript(`(() => ({
      visible: document.getElementById('app')?.classList.contains('hidden') === false,
      gateHidden: document.getElementById('cloudGate')?.classList.contains('hidden') === true,
      uid: window.BananaCloud?.auth?.currentUser?.uid || '',
      ready: window.BananaCloud?.ready === true,
      transport: window.BananaCloudSocket?.__mingrx315Transport === true,
      realtimeDisabled: window.BananaCloud?.realtime === null,
      error: document.getElementById('cloudBootError')?.textContent || '',
      isolation: typeof require === 'undefined' && typeof process === 'undefined'
    }))()`);
    if (state.visible && state.gateHidden && state.ready && state.transport) {
      assert(state.isolation && state.realtimeDisabled, 'Production renderer isolation/transport regressed');
      return state;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not open the shell: ${JSON.stringify(state)}; renderer errors: ${fatalErrors.join(' | ')}`);
}

app.whenReady().then(async () => {
  const email = `boot-${process.pid}-${Date.now()}@example.test`;
  const password = 'cloud-boot-regression-123';
  const account = await authRequest('signUp', { email, password, returnSecureToken: true });
  await authRequest('update', { localId: account.localId, emailVerified: true, displayName: 'Cloud Boot' }, true);
  const bundle = await testBundle();
  const isolatedSession = session.fromPartition(`persist:cloud-boot-${process.pid}`);
  isolatedSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      blockedRequests.push(url.origin);
      callback({ cancel: true });
    } else callback({});
  });
  await isolatedSession.protocol.handle('file', async request => {
    const requested = fileURLToPath(request.url);
    if (requested === path.join(root, 'src/cloud-browser/cloud-v2-all.browser.js')) {
      return new Response(bundle, { headers: { 'Content-Type': 'application/javascript' } });
    }
    const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    try { return new Response(fs.readFileSync(requested), {
      headers: { 'Content-Type': contentTypes[path.extname(requested)] || 'application/octet-stream' }
    }); }
    catch { return new Response('Not found', { status: 404 }); }
  });
  win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { session: isolatedSession, preload: path.join(root, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  win.webContents.on('console-message', (...args) => {
    const details = args[1];
    const message = typeof details === 'object' ? details.message : args[2];
    if (/Uncaught|Cloud socket boot|ReferenceError|TypeError/.test(String(message))) {
      fatalErrors.push(String(message)); console.error('renderer:', message);
    }
  });
  await win.loadFile(path.join(root, 'src/index.html'));
  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('banana.status', 'online');
    document.getElementById('cloudLoginEmail').value = ${JSON.stringify(email)};
    document.getElementById('cloudLoginPassword').value = ${JSON.stringify(password)};
    document.getElementById('cloudLoginForm').requestSubmit();
  })()`);
  const fresh = await waitForShell('Fresh verified login');
  assert.equal(fresh.uid, account.localId);
  // Check the startup presence write against the real deployed rule source.
  const presence = await win.webContents.executeJavaScript(`(async () => {
    const F=window.MingrxFirebase.firestore, socket=window.BananaCloudSocket;
    const snap=await F.getDoc(F.doc(socket.db,'presence',socket.user.uid,'connections',socket.id));
    return snap.exists() && snap.data().state;
  })()`);
  assert.equal(presence, 'online');
  const call = await win.webContents.executeJavaScript(`(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const socket=window.BananaCloudSocket,F=window.MingrxFirebase.firestore;
    const errors=[];socket.on('app:error',message=>errors.push(message));
    await socket.createServer('Call regression');
    const server=state.servers.find(s=>s.name==='Call regression');
    if(!server)throw new Error('Real community creation did not reach the UI');
    selectServer(server.id);
    const channel=server.channels.find(c=>c.type==='voice');selectChannel(channel.id);
    await joinVoice(channel);
    for(let i=0;i<100&&!socket.voice;i++)await sleep(50);
    if(!socket.voice)throw new Error('Call admission failed: '+errors.join(' | '));
    const current=socket.voice,track=state.voice.localAudio?.getAudioTracks()[0];
    await socket.voiceMedia({muted:true,camera:false,screen:false});
    await socket.voiceSpeaking({speaking:true});await socket.refreshVoiceLease();
    const candidate={candidate:'candidate:1 1 UDP 2122260223 192.0.2.1 50000 typ host',sdpMid:'0',sdpMLineIndex:0,usernameFragment:'test'};
    await F.setDoc(F.doc(F.collection(current.slotRef,'signals')),{fromUserId:socket.user.uid,fromSocketId:socket.id,fromSlot:current.slotRef.id,fromUser:current.user,targetSessionId:socket.id,targetUserId:socket.user.uid,data:{candidate},createdAt:F.serverTimestamp()});
    await sleep(200);
    if(!socket.voice)throw new Error('Authorized signal listener revoked the call');
    await leaveVoice();
    const visible=element=>element?.getClientRects().length>0&&getComputedStyle(element).display!=='none';
    if(state.voice.channelId||state.voice.serverId||visible(els.voiceControls)||visible(document.getElementById('v218ActiveCall')))throw new Error('Local call indicator stayed connected after leave');
    if(track?.readyState!=='ended')throw new Error('Leaving the call did not stop the microphone');
    for(let i=0;i<100&&(await F.getDoc(current.slotRef)).exists();i++)await sleep(50);
    if((await F.getDoc(current.slotRef)).exists())throw new Error('Call slot was not removed');
    if((state.voicePresence.get(channel.id)||[]).some(row=>row.socketId===socket.id))throw new Error('Own presence row remained after leaving');
    const originalProfile=socket.publicUser,originalJoin=socket.joinVoice;
    let releaseProfile,admission;
    const profileGate=new Promise(resolve=>{releaseProfile=resolve});
    socket.publicUser=async function(...args){await profileGate;return originalProfile.apply(this,args)};
    socket.joinVoice=function(...args){admission=originalJoin.apply(this,args);return admission};
    await joinVoice(channel);await leaveVoice();releaseProfile();await admission;
    socket.publicUser=originalProfile;socket.joinVoice=originalJoin;
    if(socket.voice||state.voice.channelId||visible(els.voiceControls))throw new Error('A late admission re-entered a call after leaving');
    // Admission rejection must also roll the optimistic UI back immediately.
    const original=socket.joinVoice;
    socket.joinVoice=async()=>{throw new Error('Synthetic denied admission')};
    await joinVoice(channel);await sleep(150);socket.joinVoice=original;
    if(state.voice.channelId||visible(els.voiceControls))throw new Error('Rejected admission left a connected indicator');
    if(errors.some(message=>!message.includes('Synthetic denied')))throw new Error('Unexpected real call error: '+errors.join(' | '));
    return {joined:true,ice:true,left:true,rejectedAdmissionCleaned:true};
  })()`);
  assert(call.joined&&call.ice&&call.left&&call.rejectedAdmissionCleaned);
  console.log('Real Firebase call: admission, media, speaking, lease, ICE, leave and denied-admission UI cleanup: OK');
  await isolatedSession.flushStorageData();
  await new Promise(resolve => {
    win.webContents.once('did-finish-load', resolve);
    win.reload();
  });
  const persisted = await waitForShell('Restored persisted session');
  assert.equal(persisted.uid, account.localId);
  await win.webContents.executeJavaScript('window.BananaCloud.signOut()');
  const signedOut = await win.webContents.executeJavaScript(`(() => ({
    uid: window.BananaCloud.auth.currentUser?.uid || '',
    visible: document.getElementById('cloudAuth')?.classList.contains('hidden') === false,
    appHidden: document.getElementById('app')?.classList.contains('hidden') === true
  }))()`);
  assert.deepEqual(signedOut, { uid: '', visible: true, appHidden: true }, 'Logout did not restore the auth gate');
  await win.webContents.executeJavaScript(`(() => {
    document.getElementById('cloudLoginEmail').value = ${JSON.stringify(email)};
    document.getElementById('cloudLoginPassword').value = ${JSON.stringify(password)};
    document.getElementById('cloudLoginForm').requestSubmit();
  })()`);
  const reconnected = await waitForShell('Sign-in after logout');
  assert.equal(reconnected.uid, account.localId);
  assert.deepEqual(fatalErrors, [], 'Production Cloud boot logged runtime errors');
  assert.deepEqual(blockedRequests, [], 'Test attempted to contact a non-emulator backend');
  finish(0, 'Mingrx real Firebase auth + Cloud boot + persisted session + logout/reconnect Electron E2E: OK');
}).catch(error => finish(1, error.stack || String(error)));
