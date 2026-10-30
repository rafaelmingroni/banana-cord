const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { patchAutoUpdater } = require('./graceful-shutdown');

patchAutoUpdater(autoUpdater);

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'rafaelmingroni',
  repo: 'banana-cord'
});

let lastExtraCheck = 0;
let updaterState = {
  phase: 'idle',
  version: app.getVersion(),
  percent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  error: ''
};

function sanitizeState(next = {}) {
  return {
    phase: String(next.phase || updaterState.phase || 'idle'),
    version: String(next.version || updaterState.version || app.getVersion()),
    percent: Math.max(0, Math.min(100, Number(next.percent ?? updaterState.percent ?? 0) || 0)),
    bytesPerSecond: Math.max(0, Number(next.bytesPerSecond ?? updaterState.bytesPerSecond ?? 0) || 0),
    transferred: Math.max(0, Number(next.transferred ?? updaterState.transferred ?? 0) || 0),
    total: Math.max(0, Number(next.total ?? updaterState.total ?? 0) || 0),
    error: String(next.error || '')
  };
}

function broadcast(next) {
  updaterState = sanitizeState({ ...updaterState, ...next });
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send('banana-updater:state', updaterState);
      }
    } catch {}
  }
}

function clearTaskbarProgress() {
  for (const win of BrowserWindow.getAllWindows()) {
    try { if (!win.isDestroyed()) win.setProgressBar(-1); } catch {}
  }
}

function setTaskbarProgress(percent) {
  const value = Math.max(0, Math.min(1, Number(percent || 0) / 100));
  for (const win of BrowserWindow.getAllWindows()) {
    try { if (!win.isDestroyed()) win.setProgressBar(value); } catch {}
  }
}

autoUpdater.on('checking-for-update', () => {
  if (updaterState.phase === 'error') broadcast({ phase: 'checking', error: '' });
});

autoUpdater.on('update-not-available', () => {
  clearTaskbarProgress();
  if (updaterState.phase === 'checking' || updaterState.phase === 'error') {
    broadcast({ phase: 'idle', version: app.getVersion(), percent: 0, error: '' });
  }
});

autoUpdater.on('update-available', info => {
  broadcast({
    phase: 'downloading',
    version: info?.version || 'nova',
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    error: ''
  });
});

autoUpdater.on('download-progress', progress => {
  const percent = Number(progress?.percent || 0);
  setTaskbarProgress(percent);
  broadcast({
    phase: 'downloading',
    percent,
    bytesPerSecond: Number(progress?.bytesPerSecond || 0),
    transferred: Number(progress?.transferred || 0),
    total: Number(progress?.total || 0),
    error: ''
  });
});

autoUpdater.on('update-downloaded', info => {
  clearTaskbarProgress();
  broadcast({
    phase: 'ready',
    version: info?.version || updaterState.version || 'nova',
    percent: 100,
    error: ''
  });
});

autoUpdater.on('error', error => {
  clearTaskbarProgress();
  broadcast({
    phase: 'error',
    error: String(error?.message || 'Não foi possível concluir a atualização.')
  });
});

ipcMain.handle('banana-updater:get-state', () => updaterState);
ipcMain.handle('banana-updater:get-version', () => app.getVersion());
ipcMain.handle('banana-updater:check', async () => {
  if (!app.isPackaged) return { ok: false, reason: 'development' };
  try {
    broadcast({ phase: 'checking', error: '' });
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    broadcast({ phase: 'error', error: String(error?.message || error || 'Falha ao verificar atualização.') });
    return { ok: false, reason: 'check-failed' };
  }
});

ipcMain.on('banana-updater:install', () => {
  if (updaterState.phase !== 'ready') return;
  broadcast({ phase: 'installing', percent: 100, error: '' });
  // NSIS continues to be used under the hood, but the update itself is silent.
  // The first/manual install remains the normal wizard from the downloaded EXE.
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 350);
});

function extraCheck() {
  if (!app.isPackaged) return;
  if (['downloading', 'ready', 'installing'].includes(updaterState.phase)) return;
  const stamp = Date.now();
  if (stamp - lastExtraCheck < 5 * 60 * 1000) return;
  lastExtraCheck = stamp;
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 800);
}

app.on('browser-window-focus', extraCheck);
app.whenReady().then(() => {
  const timer = setInterval(extraCheck, 30 * 60 * 1000);
  timer.unref?.();
});

require('./tray.js');
require('./e2ee-main.js');
require('./main.js');
require('./screen-share-main-fix.js');
