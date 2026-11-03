const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

// Mingrx 3.0 is an in-place upgrade from Banana Cord. Keep the legacy Chromium
// profile for existing installations so Firebase auth, local preferences and the
// local E2EE vault survive the rebrand. Fresh installs use the normal Mingrx path.
let legacyUserDataUsed = false;
try {
  const legacy = path.join(app.getPath('appData'), 'Banana Cord');
  const current = app.getPath('userData');
  if (path.resolve(legacy) !== path.resolve(current) && fs.existsSync(legacy)) {
    app.setPath('userData', legacy);
    legacyUserDataUsed = true;
  }
} catch (error) {
  console.warn('Mingrx migration: could not inspect legacy userData path:', error?.message || error);
}

try { app.setName('Mingrx'); } catch {}
try {
  ipcMain.handle('mingrx:migration-info', () => ({
    legacyUserDataUsed,
    version: app.getVersion(),
    brand: 'Mingrx'
  }));
} catch {}

const PRIMARY_SCHEME = 'mingrx';
const LEGACY_SCHEME = 'bananacord';
const ACCEPTED_SCHEMES = new Set([PRIMARY_SCHEME, LEGACY_SCHEME]);
let pendingCode = '';

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseDeepLink(value) {
  const raw = String(value || '').trim();
  let url;
  try { url = new URL(raw); }
  catch { return ''; }
  const scheme = String(url.protocol || '').replace(':', '').toLowerCase();
  if (!ACCEPTED_SCHEMES.has(scheme)) return '';
  const fromPath = url.pathname.split('/').filter(Boolean).pop() || '';
  const fromQuery = url.searchParams.get('code') || url.searchParams.get('invite') || '';
  const candidate = url.hostname.toLowerCase() === 'join' ? fromPath : (fromQuery || fromPath || url.hostname);
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
    const applyBrand = () => {
      try { win.setTitle('Mingrx'); } catch {}
      try {
        const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'mingrx.ico'));
        if (!icon.isEmpty()) win.setIcon(icon);
      } catch {}
    };
    applyBrand();
    win.webContents.on('page-title-updated', event => {
      event.preventDefault();
      applyBrand();
    });
    win.webContents.once('did-finish-load', () => {
      applyBrand();
      if (pendingCode) dispatchInvite(pendingCode);
    });
  });

  app.whenReady().then(() => {
    try { app.setAppUserModelId('com.bananacord.app'); } catch {}
    try { app.setAsDefaultProtocolClient(PRIMARY_SCHEME); } catch {}
    // Keep bananacord:// working so old invites survive the public migration.
    try { app.setAsDefaultProtocolClient(LEGACY_SCHEME); } catch {}
    const initialCode = findDeepLink(process.argv);
    if (initialCode) setTimeout(() => dispatchInvite(initialCode), 450);
  });

  require('./main-v110.js');
}
