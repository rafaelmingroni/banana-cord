const { app, BrowserWindow } = require('electron');

const PRIMARY_SCHEME = 'mingrx';
const LEGACY_SCHEME = 'bananacord';
const ACCEPTED_SCHEMES = new Set([PRIMARY_SCHEME, LEGACY_SCHEME]);
let pendingCode = '';

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseDeepLink(value) {
  const raw = String(value || '').trim();
  let u;
  try { u = new URL(raw); }
  catch { return ''; }
  const scheme = String(u.protocol || '').replace(':', '').toLowerCase();
  if (!ACCEPTED_SCHEMES.has(scheme)) return '';
  const fromPath = u.pathname.split('/').filter(Boolean).pop() || '';
  const fromQuery = u.searchParams.get('code') || u.searchParams.get('invite') || '';
  const candidate = u.hostname.toLowerCase() === 'join' ? fromPath : (fromQuery || fromPath || u.hostname);
  const code = normalizeCode(candidate);
  return [8, 12].includes(code.length) ? code : '';
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

function enforceRendererScale(win) {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  const reset = () => {
    try { wc.setZoomFactor(1); } catch {}
  };

  reset();
  wc.on('did-finish-load', reset);
  wc.on('did-navigate-in-page', reset);

  // Mingrx is a fixed desktop shell, not a browser page. Chromium zoom shortcuts
  // can otherwise leave the whole UI at 80/90% and make the private sidebar
  // look collapsed even though its CSS width is correct.
  wc.on('before-input-event', (event, input) => {
    const key = String(input?.key || '').toLowerCase();
    const zoomShortcut = !!input?.control && ['+', '=', '-', '_', '0'].includes(key);
    if (!zoomShortcut) return;
    event.preventDefault();
    reset();
  });
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
    enforceRendererScale(win);
    win.webContents.once('did-finish-load', () => {
      if (pendingCode) dispatchInvite(pendingCode);
    });
  });

  app.whenReady().then(() => {
    try { app.setAsDefaultProtocolClient(PRIMARY_SCHEME); } catch {}
    // Keep old bananacord:// invites valid during the preview migration.
    try { app.setAsDefaultProtocolClient(LEGACY_SCHEME); } catch {}
    const initialCode = findDeepLink(process.argv);
    if (initialCode) setTimeout(() => dispatchInvite(initialCode), 450);
  });

  require('./main-v110.js');
}
