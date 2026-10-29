const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');

let tray = null;
let quitting = false;
let hostActive = false;
let closeHintShown = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function mainWindow() {
  return BrowserWindow.getAllWindows().find(w => !w.isDestroyed()) || null;
}

function showWindow() {
  const win = mainWindow();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function rebuildMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Banana Cord', click: showWindow },
    { type: 'separator' },
    {
      label: 'Mutar / Desmutar',
      click: () => { const win = mainWindow(); if (win) win.webContents.send('shortcut:mute'); }
    },
    { label: `Hospedando: ${hostActive ? 'ativo' : 'inativo'}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Sair do Banana Cord',
      click: () => { quitting = true; app.quit(); }
    }
  ]));
}

app.on('banana:host-status', data => {
  const status = typeof data === 'string' ? data : data?.status;
  if (['starting', 'local-ready', 'tunneling', 'ready'].includes(status)) hostActive = true;
  if (['stopped', 'tunnel-ended'].includes(status)) hostActive = false;
  rebuildMenu();
});

app.on('browser-window-created', (_event, win) => {
  win.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (!closeHintShown && tray && process.platform === 'win32') {
      closeHintShown = true;
      try {
        tray.displayBalloon({
          title: 'Banana Cord continua aberto',
          content: 'A janela foi escondida. O app continua rodando na bandeja — inclusive o servidor, se você estiver hospedando.',
          iconType: 'info'
        });
      } catch {}
    }
  });
});

app.on('before-quit', () => { quitting = true; });
app.on('second-instance', showWindow);

app.whenReady().then(() => {
  app.setAppUserModelId('com.bananacord.app');
  try {
    const raw = nativeImage.createFromPath(path.join(__dirname, 'assets', 'banana-cord.png'));
    const icon = raw.isEmpty() ? raw : raw.resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Banana Cord');
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
    rebuildMenu();
  } catch (e) {
    console.warn('Banana Cord tray:', e?.message || e);
  }
});

module.exports = { showWindow, isQuitting: () => quitting };
