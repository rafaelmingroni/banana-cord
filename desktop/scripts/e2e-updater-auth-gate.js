// The updater must remain usable while login or verified-session recovery is
// covering the app. Visibility classes alone cannot detect an occluded card.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, session } = require('electron');

const root = path.resolve(__dirname, '..');
const testData = fs.mkdtempSync(path.join(os.tmpdir(), 'mingrx-updater-auth-'));
app.setPath('userData', testData);
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
// Keep assertion failures from being replaced by Electron's default quit(0).
app.on('window-all-closed', () => {});

const calls = { check: 0, download: 0, install: 0 };
const version = require('../package.json').version;
const updaterState = { phase: 'idle', version, percent: 0 };
const socialSettings = { idleSeconds: 0, idleState: 'active', activity: null,
  settings: { shareActivity: true, autoAwayMinutes: 5,
    startup: { supported: true, enabled: false, registered: false } }, startupLaunch: false };
const handlers = {
  'update:get-config': () => ({ repoUrl: 'https://github.com/rafaelmingroni/mingrx-app', autoCheck: true, autoDownload: true, currentVersion: version }),
  'update:get-state': () => updaterState,
  'banana-updater:get-state': () => updaterState,
  'banana-updater:get-version': () => version,
  'banana-updater:check': () => { calls.check++; return { ok: true }; },
  'update:download': () => { calls.download++; return updaterState; },
  'banana-v21:get-settings': () => socialSettings,
  'banana-v21:set-settings': () => socialSettings,
  'banana-v21:get-system-languages': () => ['pt-BR'],
  'clipboard:write': () => true,
  'ptt:configure': () => ({ ok: true })
};
for (const [name, callback] of Object.entries(handlers)) ipcMain.handle(name, callback);
ipcMain.on('banana-updater:install', () => { calls.install++; });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let win;
let finished = false;
const timeout = setTimeout(() => finish(1, 'Updater before-login E2E failed: hard timeout'), 25000);
function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  (code ? console.error : console.log)(message);
  try { win?.destroy(); } catch {}
  try { fs.rmSync(testData, { recursive: true, force: true }); } catch {}
  app.exit(code);
}

async function pointAt(id) {
  const point = await win.webContents.executeJavaScript(`(() => {
    const element=document.getElementById(${JSON.stringify(id)});
    const bounds=element?.getBoundingClientRect();
    if (!bounds || bounds.width<=0 || bounds.height<=0) return null;
    const x=bounds.left+bounds.width/2, y=bounds.top+bounds.height/2;
    const top=document.elementFromPoint(x,y);
    return { x,y,hit:element===top || element.contains(top),top:top?.id || top?.className || '',
      disabled:!!element.disabled,gateVisible:!document.getElementById('cloudGate')?.classList.contains('hidden') };
  })()`);
  assert(point?.gateVisible, 'The unauthenticated Cloud gate must stay visible during updater checks');
  assert(point?.hit, `${id} is not above the login screen: ${JSON.stringify(point)}`);
  assert(!point.disabled, `${id} is disabled`);
  return point;
}

async function click(id) {
  const point = await pointAt(id);
  win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(point.x), y: Math.round(point.y) });
  win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
  await sleep(300);
}

async function phase(name, extra = {}) {
  win.webContents.send('banana-updater:state', { phase: name, version: '3.1.99', percent: 0, ...extra });
  await sleep(80);
  await pointAt('bananaUpdaterTitle');
}

app.whenReady().then(async () => {
  // No remote service is involved: only production renderer/preload/CSS and
  // updater IPC events. The persisted account store is isolated for this test.
  session.defaultSession.webRequest.onBeforeRequest((request, callback) => {
    callback({ cancel: /^(https?|wss?):/.test(request.url) });
  });
  win = new BrowserWindow({ show: false, width: 1280, height: 800,
    webPreferences: { preload: path.join(root, 'preload.js'), nodeIntegration: false,
      contextIsolation: true, sandbox: true }
  });
  await win.loadFile(path.join(root, 'src/index.html'));
  await sleep(150);
  const initial = await win.webContents.executeJavaScript(`(() => {
    const gate=document.getElementById('cloudGate');
    if (!gate) return null;
    gate.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    return { anonymous:!window.BananaCloud?.auth?.currentUser,
      isolated:typeof require==='undefined' && typeof process==='undefined' };
  })()`);
  assert(initial?.anonymous && initial.isolated, 'Test must use the unauthenticated, isolated production renderer');

  await phase('checking');
  await phase('downloading', { percent: 42, transferred: 42, total: 100 });
  const percent = await win.webContents.executeJavaScript("document.getElementById('bananaUpdaterPercent').textContent");
  assert.equal(percent, '42%', 'Download progress must be visible before login');

  await phase('error', { error: 'Test download interrupted' });
  await click('bananaUpdaterRetry');
  assert.equal(calls.check, 1, 'The visible retry action must request another update check');

  await phase('available', { autoDownload: false });
  await click('bananaUpdaterDownload');
  assert.equal(calls.download, 1, 'A disabled automatic download must offer a working download action');

  await phase('ready', { percent: 100 });
  await click('bananaUpdaterInstall');
  assert.equal(calls.install, 1, 'The ready action must request installation without requiring login');
  await pointAt('bananaUpdaterOverlay');

  finish(0, 'Mingrx updater above login gate: checking, download, retry, available and install: OK');
}).catch(error => finish(1, error.stack || String(error)));
