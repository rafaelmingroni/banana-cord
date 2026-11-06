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
let peerWindow;
let finished = false;
const fatalErrors = [];
const blockedRequests = [];
const hardTimeout = setTimeout(() => finish(1, 'Cloud boot E2E failed: hard timeout'), 150000);
function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(hardTimeout);
  if (message) (code ? console.error : console.log)(message);
  try { win?.destroy(); } catch {}
  try { peerWindow?.destroy(); } catch {}
  try { fs.rmSync(testData, { recursive: true, force: true }); } catch {}
  app.exit(code);
}

async function waitForShell(label, target = win) {
  const deadline = Date.now() + 25000;
  let state;
  while (Date.now() < deadline) {
    state = await target.webContents.executeJavaScript(`(() => ({
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

async function openClient(bundle, suffix) {
  const isolatedSession = session.fromPartition(`persist:cloud-boot-${process.pid}-${suffix}`);
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
  const client = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { session: isolatedSession, preload: path.join(root, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  client.webContents.on('console-message', (...args) => {
    const details = args[1];
    const message = typeof details === 'object' ? details.message : args[2];
    if (/Uncaught|Cloud socket boot|ReferenceError|TypeError/.test(String(message))) {
      fatalErrors.push(String(message)); console.error('renderer:', message);
    }
  });
  await client.loadFile(path.join(root, 'src/index.html'));
  // Production diagnosis found the affected client's leases 117 seconds
  // behind Firebase. A valid login must still admit a real voice session.
  await client.webContents.executeJavaScript(`window.__realDateNow=Date.now;Date.now=()=>window.__realDateNow()+${suffix==='peer'?300000:-117000};void 0;`);
  return client;
}

app.whenReady().then(async () => {
  const email = `boot-${process.pid}-${Date.now()}@example.test`;
  const password = 'cloud-boot-regression-123';
  const account = await authRequest('signUp', { email, password, returnSecureToken: true });
  await authRequest('update', { localId: account.localId, emailVerified: true, displayName: 'Cloud Boot' }, true);
  const bundle = await testBundle();
  win = await openClient(bundle, 'owner');
  const isolatedSession = win.webContents.session;
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
    const data=snap.data();
    return {state:data.state,leaseMs:data.expiresAt.toMillis()-data.updatedAt.toMillis(),clockErrorMs:Math.abs(socket.serverNow()-window.__realDateNow())};
  })()`);
  assert.equal(presence.state, 'online');
  assert(presence.leaseMs>115000&&presence.leaseMs<=125000&&presence.clockErrorMs<5000,'Presence must use server time despite a clock 117 seconds behind');
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
    const oldNow=Date.now;Date.now=()=>window.__realDateNow()+86400000;
    await socket.refreshVoiceLease();await socket.publishPresence();Date.now=oldNow;
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
  const peerEmail = `peer-${process.pid}-${Date.now()}@example.test`;
  const peerAccount = await authRequest('signUp', { email: peerEmail, password, returnSecureToken: true });
  await authRequest('update', { localId: peerAccount.localId, emailVerified: true, displayName: 'Call Peer' }, true);
  peerWindow = await openClient(bundle, 'peer');
  await peerWindow.webContents.executeJavaScript(`(() => {
    document.getElementById('cloudLoginEmail').value = ${JSON.stringify(peerEmail)};
    document.getElementById('cloudLoginPassword').value = ${JSON.stringify(password)};
    document.getElementById('cloudLoginForm').requestSubmit();
  })()`);
  await waitForShell('Second verified account', peerWindow);
  const room = await win.webContents.executeJavaScript(`(async()=>{
    let stage='profile';try{
    const socket=window.BananaCloudSocket,F=window.MingrxFirebase.firestore;
    // Existing production profiles include avatars; retain that payload shape.
    await socket.updateProfile({name:'Cloud Boot',avatar:'data:image/png;base64,'+'A'.repeat(29130)});
    // Match an existing community: no parent memberRoles, an owner and admin,
    // an unrestricted channel and a channel restricted to administrators.
    stage='create existing-schema server';await socket.createServer('Existing schema call regression');
    const server=state.servers.find(s=>s.name==='Existing schema call regression');
    stage='create restricted channel';await socket.createChannel({serverId:server.id,name:'Admin voice',type:'voice',allowedRoles:['admin']});
    await F.updateDoc(F.doc(socket.db,'servers',server.id),{createdAt:F.Timestamp.fromMillis(1700000000000)});
    const loaded=await socket.loadServer(server.id);
    return {id:server.id,invite:loaded.inviteCode,publicChannel:'voice-general',adminChannel:loaded.channels.find(c=>c.name==='Admin voice').id};
    }catch(error){throw new Error(stage+': '+error.code+' '+error.message)}
  })()`);
  console.log('Two-account fixture created');
  await peerWindow.webContents.executeJavaScript(`window.BananaCloudSocket.joinServer(${JSON.stringify(room.invite)}).catch(error=>{throw new Error('Peer invite join: '+error.code+' '+error.message)})`);
  console.log('Peer joined existing-schema community');
  await win.webContents.executeJavaScript(`(async()=>{
    const socket=window.BananaCloudSocket,F=window.MingrxFirebase.firestore;
    await F.updateDoc(F.doc(socket.db,'servers',${JSON.stringify(room.id)},'members',${JSON.stringify(peerAccount.localId)}),{role:'admin'});
  })()`);
  for (const client of [win,peerWindow]) {
    await client.webContents.executeJavaScript(`(() => {
      const socket=window.BananaCloudSocket;window.__callFailures=[];
      for(const method of ['joinVoice','voiceMedia','voiceSpeaking','signal','refreshVoiceLease']){
        const original=socket[method];socket[method]=async function(...args){
          try{return await original.apply(this,args)}catch(error){window.__callFailures.push(method+': '+(error.code||error.message));throw error;}
        };
      }
    })()`);
  }
  async function enter(client, channelId) {
    await client.webContents.executeJavaScript(`(async()=>{
      const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),socket=window.BananaCloudSocket;
      const server=await socket.loadServer(${JSON.stringify(room.id)});
      for(let i=0;i<100&&!state.servers.some(s=>s.id===server.id);i++)await sleep(50);
      selectServer(server.id);const channel=server.channels.find(c=>c.id===${JSON.stringify(channelId)});selectChannel(channel.id);
      await joinVoice(channel);
      for(let i=0;i<100&&!socket.voice;i++)await sleep(50);
      if(!socket.voice)throw new Error('Two-account admission failed: '+window.__callFailures.join(' | '));
    })()`);
  }
  async function connected(client, label) {
    let last;
    for(let i=0;i<150;i++){
      last=await client.webContents.executeJavaScript(`(async() => ({
        admitted:!!window.BananaCloudSocket.voice,channel:state.voice.channelId,
        failures:window.__callFailures,peers:await Promise.all([...state.voice.peers.values()].map(async p=>{
          const stats=await p.pc.getStats();let packets=0;stats.forEach(row=>{if(row.type==='inbound-rtp'&&row.kind==='audio')packets+=row.packetsReceived||0});
          return {state:p.pc.connectionState,ice:p.pc.iceConnectionState,audio:p.remoteStream.getAudioTracks().filter(t=>t.readyState==='live').length,packets};
        }))
      }))()`);
      if(last.failures.length)throw new Error(label+': '+JSON.stringify(last));
      if(last.admitted&&last.peers.length===1&&last.peers[0].state==='connected'&&last.peers[0].audio===1&&last.peers[0].packets>0)return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error(label+' did not establish real peer audio: '+JSON.stringify(last));
  }
  async function leave(client) {
    const left=await client.webContents.executeJavaScript(`(async()=>{
      const socket=window.BananaCloudSocket,F=window.MingrxFirebase.firestore,current=socket.voice;
      const track=state.voice.localAudio?.getAudioTracks()[0];await leaveVoice();
      const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      for(let i=0;i<100&&current&&(await F.getDoc(current.slotRef)).exists();i++)await sleep(50);
      const visible=el=>el?.getClientRects().length>0&&getComputedStyle(el).display!=='none';
      return {transport:!!socket.voice,channel:state.voice.channelId,mic:track?.readyState,indicator:visible(document.getElementById('v218ActiveCall')),slot:current&&(await F.getDoc(current.slotRef)).exists(),failures:window.__callFailures};
    })()`);
    assert.deepEqual(left,{transport:false,channel:null,mic:'ended',indicator:false,slot:false,failures:[]});
  }
  for (const channelId of [room.publicChannel,room.adminChannel]) {
    await enter(win,channelId);await enter(peerWindow,channelId);
    await connected(win,'Owner');await connected(peerWindow,'Administrator');
    await peerWindow.webContents.executeJavaScript(`(async()=>{const s=window.BananaCloudSocket;await s.voiceMedia({muted:true,camera:false,screen:false});await s.voiceSpeaking({speaking:false});await s.refreshVoiceLease()})()`);
    await leave(peerWindow);await enter(peerWindow,channelId);
    await connected(win,'Owner after peer re-entry');await connected(peerWindow,'Administrator after re-entry');
    await win.webContents.executeJavaScript('reconnectCurrentVoice()');
    await connected(win,'Owner after reconnect');await connected(peerWindow,'Administrator after owner reconnect');
    await leave(peerWindow);await leave(win);
  }
  console.log('Two isolated Firebase accounts: clock skew -117s/+300s, existing schema, owner/admin, public/restricted voice, received audio packets, leave/re-entry/reconnect and clean indicators: OK');
  await peerWindow.webContents.executeJavaScript('window.BananaCloud.signOut()');
  peerWindow.destroy();peerWindow=null;
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
