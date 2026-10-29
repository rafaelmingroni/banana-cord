const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');
const { prepareRendererShutdown } = require('./graceful-shutdown');

let tray = null;
let quitting = false;
let hostActive = false;
let closeHintShown = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

const isCloudV2 = () => /^2\.0\./.test(String(app.getVersion() || ''));

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
  const template = [
    { label: 'Abrir Banana Cord', click: showWindow },
    { label: `Versão ${app.getVersion()}`, enabled: false },
    { label: isCloudV2() ? 'Modo: Banana Cloud' : `Hospedando: ${hostActive ? 'ativo' : 'inativo'}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Mutar / Desmutar',
      click: () => { const win = mainWindow(); if (win) win.webContents.send('shortcut:mute'); }
    },
    { type: 'separator' },
    {
      label: 'Sair do Banana Cord',
      click: async () => {
        if (quitting) return;
        quitting = true;
        try { await prepareRendererShutdown(); } catch {}
        app.quit();
      }
    }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
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
          content: isCloudV2()
            ? 'A janela foi escondida. O Banana Cord continua rodando na bandeja para manter presença, chamadas e notificações.'
            : 'A janela foi escondida. O app continua rodando na bandeja — inclusive o servidor, se você estiver hospedando.',
          iconType: 'info',
          largeIcon: true
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
    const trayPath = path.join(__dirname, 'assets', 'banana-tray.png');
    const raw = nativeImage.createFromPath(trayPath);
    const icon = raw.isEmpty() ? raw : raw.resize({ width: 20, height: 20, quality: 'best' });
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
