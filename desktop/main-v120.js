const { app, BrowserWindow } = require('electron');

const SCHEME = 'bananacord';
let pendingCode = '';

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseDeepLink(value) {
  const raw = String(value || '').trim();
  if (!raw.toLowerCase().startsWith(`${SCHEME}://`)) return '';
  try {
    const u = new URL(raw);
    const fromPath = u.pathname.split('/').filter(Boolean).pop() || '';
    const fromQuery = u.searchParams.get('code') || u.searchParams.get('invite') || '';
    const candidate = u.hostname.toLowerCase() === 'join' ? fromPath : (fromQuery || fromPath || u.hostname);
    const code = normalizeCode(candidate);
    return [8, 12].includes(code.length) ? code : '';
  } catch {
    return '';
  }
}

function findDeepLink(argv = []) {
  for (const arg of argv) {
    const code = parseDeepLink(arg);
    if (code) return code;
  }
  return '';
}

function focusWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return null;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
}

function dispatchInvite(code) {
  const clean = normalizeCode(code);
  if (![8, 12].includes(clean.length)) return;
  pendingCode = clean;
  const win = focusWindow();
  if (!win || win.webContents.isLoading()) return;
  win.webContents.send('invite:deep-link', { code: clean });
  pendingCode = '';
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const code = findDeepLink(argv);
    if (code) dispatchInvite(code);
    else focusWindow();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    const code = parseDeepLink(url);
    if (code) dispatchInvite(code);
  });

  app.on('browser-window-created', (_event, win) => {
    win.webContents.once('did-finish-load', () => {
      if (pendingCode) dispatchInvite(pendingCode);
    });
  });

  app.whenReady().then(() => {
    try { app.setAsDefaultProtocolClient(SCHEME); } catch {}
    const initialCode = findDeepLink(process.argv);
    if (initialCode) setTimeout(() => dispatchInvite(initialCode), 450);
  });

  require('./main-v110.js');
}
