const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let installRequested = false;
let updaterState = { phase: 'idle', version: '2.0.17', percent: 0, bytesPerSecond: 0, transferred: 0, total: 0, error: '' };

ipcMain.handle('update:get-config', async () => ({ repoUrl: 'https://github.com/rafaelmingroni/banana-cord', autoCheck: true, autoDownload: true, currentVersion: '2.0.17' }));
ipcMain.handle('update:get-state', async () => ({ status: 'idle', progress: 0, message: '' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => updaterState);
ipcMain.handle('banana-updater:get-version', async () => '2.0.17');
ipcMain.handle('banana-updater:check', async () => ({ ok: true }));
ipcMain.on('banana-updater:install', () => { installRequested = true; });

const hardTimeout = setTimeout(() => {
  console.error('V2.0.17 updater E2E failed: hard timeout');
  app.exit(1);
}, 16000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 40);
}
function fail(message) { finish(1, `V2.0.17 updater E2E failed: ${message}`); }

async function inspect(win, expression) {
  return win.webContents.executeJavaScript(expression, true);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 180));

  updaterState = {
    phase: 'downloading', version: '2.0.18', percent: 42,
    bytesPerSecond: 3145728, transferred: 44040192, total: 104857600, error: ''
  };
  win.webContents.send('banana-updater:state', updaterState);
  await new Promise(resolve => setTimeout(resolve, 120));

  const downloading = await inspect(win, `(() => ({
    panelVisible: !document.getElementById('bananaUpdater')?.classList.contains('hidden'),
    title: document.getElementById('bananaUpdaterTitle')?.textContent || '',
    subtitle: document.getElementById('bananaUpdaterSubtitle')?.textContent || '',
    percent: document.getElementById('bananaUpdaterPercent')?.textContent || '',
    badge: document.getElementById('updateBadge')?.textContent || '',
    progressWidth: document.getElementById('bananaUpdaterProgress')?.style.width || ''
  }))()`);

  if (!downloading.panelVisible) return fail('download panel is not visible');
  if (!downloading.title.includes('2.0.18')) return fail(`download title missing version: ${downloading.title}`);
  if (downloading.percent !== '42%') return fail(`download percent incorrect: ${downloading.percent}`);
  if (downloading.progressWidth !== '42%') return fail(`progress bar incorrect: ${downloading.progressWidth}`);
  if (!downloading.badge.includes('42%')) return fail(`header badge missing progress: ${downloading.badge}`);

  updaterState = { ...updaterState, phase: 'ready', percent: 100 };
  win.webContents.send('banana-updater:state', updaterState);
  await new Promise(resolve => setTimeout(resolve, 100));

  const ready = await inspect(win, `(() => ({
    actionsVisible: !document.getElementById('bananaUpdaterActions')?.classList.contains('hidden'),
    installText: document.getElementById('bananaUpdaterInstall')?.textContent || '',
    laterText: document.getElementById('bananaUpdaterLater')?.textContent || '',
    badge: document.getElementById('updateBadge')?.textContent || ''
  }))()`);
  if (!ready.actionsVisible) return fail('ready actions are hidden');
  if (ready.installText !== 'Atualizar agora' || ready.laterText !== 'Depois') return fail('ready action labels are incorrect');
  if (!ready.badge.includes('Atualização pronta')) return fail(`ready badge missing: ${ready.badge}`);

  await inspect(win, `document.getElementById('bananaUpdaterLater').click(); true`);
  await new Promise(resolve => setTimeout(resolve, 50));
  const minimized = await inspect(win, `document.getElementById('bananaUpdater').classList.contains('hidden')`);
  if (!minimized) return fail('Depois did not minimize updater');

  await inspect(win, `document.getElementById('updateBadge').click(); document.getElementById('bananaUpdaterInstall').click(); true`);
  await new Promise(resolve => setTimeout(resolve, 330));
  const overlayVisible = await inspect(win, `!document.getElementById('bananaUpdaterOverlay').classList.contains('hidden')`);
  if (!overlayVisible) return fail('install transition overlay did not appear');
  if (!installRequested) return fail('install IPC was not requested');

  console.log('Banana Cord V2.0.17 premium updater Electron UI test: OK');
  console.log(JSON.stringify({ downloading, ready, overlayVisible, installRequested }));
  try { win.destroy(); } catch {}
  finish(0);
}).catch(error => fail(error?.stack || error?.message || String(error)));
