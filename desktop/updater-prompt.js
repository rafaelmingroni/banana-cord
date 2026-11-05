const { app, BrowserWindow, ipcMain } = require('electron');
require('./update-service');
function sourceWindow(event) {
  try { return BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0] || null; }
  catch { return BrowserWindow.getAllWindows()[0] || null; }
}

ipcMain.on('banana-call:attention', (event, active) => {
  const win = sourceWindow(event);
  if (!win || win.isDestroyed()) return;
  try { win.flashFrame(!!active); } catch {}
});

ipcMain.on('banana-call:focus', event => {
  const win = sourceWindow(event);
  if (!win || win.isDestroyed()) return;
  try {
    win.flashFrame(false);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } catch {}
});

require('./tray.js');
require('./e2ee-main.js');
require('./main.js');
require('./screen-share-main-fix.js');
require('./ptt-main.js');
require('./rtc-config-main.js');
