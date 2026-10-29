const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { patchAutoUpdater } = require('./graceful-shutdown');

patchAutoUpdater(autoUpdater);

let seenAvailable = '';
let seenDownloaded = '';
let lastExtraCheck = 0;

function showAvailable(info) {
  const version = info?.version || 'nova';
  if (seenAvailable === version) return;
  seenAvailable = version;
  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização do Banana Cord',
    message: `Banana Cord ${version} disponível`,
    detail: 'A atualização começou a baixar automaticamente em segundo plano. Você pode continuar usando o Banana Cord.',
    buttons: ['OK'],
    defaultId: 0,
    noLink: true
  }).catch(() => {});
}

function showDownloaded(info) {
  const version = info?.version || 'nova';
  if (seenDownloaded === version) return;
  seenDownloaded = version;
  dialog.showMessageBox({
    type: 'info',
    title: 'Atualização pronta',
    message: `Banana Cord ${version} está pronto para instalar`,
    detail: 'Ao reiniciar, o Banana Cord encerra a call atual com segurança, limpa sua sessão no Banana Cloud e abre novamente já atualizado. Se escolher Depois, a atualização fica pronta para a próxima saída do app.',
    buttons: ['Reiniciar e instalar', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }).then(({ response }) => {
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall(false, true));
  }).catch(() => {});
}

autoUpdater.on('update-available', showAvailable);
autoUpdater.on('update-downloaded', showDownloaded);

autoUpdater.on('download-progress', progress => {
  try {
    const win = require('electron').BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.setProgressBar(Math.max(0, Math.min(1, Number(progress?.percent || 0) / 100)));
  } catch {}
});

autoUpdater.on('update-downloaded', () => {
  try { const win = require('electron').BrowserWindow.getAllWindows()[0]; if (win && !win.isDestroyed()) win.setProgressBar(-1); } catch {}
});
autoUpdater.on('error', () => {
  try { const win = require('electron').BrowserWindow.getAllWindows()[0]; if (win && !win.isDestroyed()) win.setProgressBar(-1); } catch {}
});

function extraCheck() {
  if (!app.isPackaged) return;
  const stamp = Date.now();
  if (stamp - lastExtraCheck < 5 * 60 * 1000) return;
  lastExtraCheck = stamp;
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 800);
}

app.on('browser-window-focus', extraCheck);
app.whenReady().then(() => { const timer = setInterval(extraCheck, 30 * 60 * 1000); timer.unref?.(); });

require('./tray.js');
require('./main.js');
require('./screen-share-main-fix.js');
