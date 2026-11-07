const { app, BrowserWindow, session, desktopCapturer, ipcMain, clipboard, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { startBananaServer } = require('./server/server');
const { autoUpdater } = require('electron-updater');
require('./auth-vault').install();

let mainWindow;
let localServerHandle = null;
let tunnelProc = null;
let tunnelUrl = '';
const {loadUpdateConfig,configureUpdater,scheduleAutomaticUpdateCheck,emitUpdateState}=require('./update-service');

function sendHostStatus(status,extra={}) { app.emit('banana:host-status',{status,...extra}); }

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function isTrustedRenderer(webContents) {
  try {
    const current = new URL(webContents?.getURL?.() || '');
    return current.protocol === 'file:' && current.pathname.endsWith('/src/index.html');
  } catch {
    return false;
  }
}

function hardenWindow(win) {
  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    const safe = safeExternalUrl(url);
    if (safe) shell.openExternal(safe).catch(() => {});
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    event.preventDefault();
    const safe = safeExternalUrl(url);
    if (safe) shell.openExternal(safe).catch(() => {});
  });
  wc.on('will-attach-webview', event => event.preventDefault());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#111214',
    title: 'Banana Cord',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'banana-cord.png'),
    webPreferences: {
      // The renderer only receives explicitly allowed operations from preload.
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: true
    }
  });
  hardenWindow(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function isAllowedDownloadUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return false;
    return new Set([
      'github.com',
      'www.github.com',
      'release-assets.githubusercontent.com',
      'objects.githubusercontent.com'
    ]).has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Muitos redirecionamentos.'));
    if (!isAllowedDownloadUrl(url)) return reject(new Error('Origem de download bloqueada por segurança.'));
    const request = https.get(url, { headers: { 'User-Agent': 'BananaCord/2.0.15' } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        const next = new URL(response.headers.location, url).toString();
        response.resume();
        if (!isAllowedDownloadUrl(next)) return reject(new Error('Redirecionamento de download bloqueado por segurança.'));
        return resolve(download(next, destination, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Download falhou: HTTP ${response.statusCode}`));
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const temp = destination + '.part';
      const file = fs.createWriteStream(temp);
      response.pipe(file);
      file.on('finish', () => file.close(() => {
        try { fs.renameSync(temp, destination); } catch (e) { return reject(e); }
        resolve(destination);
      }));
      file.on('error', reject);
    });
    request.setTimeout(30000, () => request.destroy(new Error('Tempo esgotado no download.')));
    request.on('error', reject);
  });
}

async function ensureCloudflared() {
  if (process.platform !== 'win32') throw new Error('O túnel automático desta versão está preparado para Windows.');
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const exe = path.join(app.getPath('userData'), 'bin', 'cloudflared.exe');
  if (fs.existsSync(exe) && fs.statSync(exe).size > 1_000_000) return exe;
  sendHostStatus('downloading', { message: 'Preparando acesso pela internet…' });
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${arch}.exe`;
  await download(url, exe);
  return exe;
}

async function stopHosting() {
  if (tunnelProc) {
    try { tunnelProc.kill(); } catch {}
    tunnelProc = null;
  }
  tunnelUrl = '';
  if (localServerHandle) {
    try { await localServerHandle.close(); } catch {}
    localServerHandle = null;
  }
  sendHostStatus('stopped');
}

async function startHosting() {
  if (localServerHandle) return { url: tunnelUrl || 'http://127.0.0.1:3210', localUrl: 'http://127.0.0.1:3210' };
  try {
    sendHostStatus('starting', { message: 'Iniciando Banana Cord…' });
    const dataDir = path.join(app.getPath('userData'), 'host-data');
    fs.mkdirSync(dataDir, { recursive: true });
    localServerHandle = await startBananaServer({ port: 3210, dataFile: path.join(dataDir, 'data.json') });
    sendHostStatus('local-ready', { localUrl: 'http://127.0.0.1:3210' });

    const cloudflared = await ensureCloudflared();
    sendHostStatus('tunneling', { message: 'Abrindo acesso seguro pela internet…' });
    tunnelProc = spawn(cloudflared, ['tunnel', '--url', 'http://127.0.0.1:3210', '--no-autoupdate'], { windowsHide: true });

    return await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Não consegui obter o endereço público. Tente novamente.'));
        }
      }, 30000);
      const inspect = data => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && !settled) {
          settled = true;
          clearTimeout(timer);
          tunnelUrl = match[0];
          sendHostStatus('ready', { url: tunnelUrl, localUrl: 'http://127.0.0.1:3210' });
          resolve({ url: tunnelUrl, localUrl: 'http://127.0.0.1:3210' });
        }
      };
      tunnelProc.stdout.on('data', inspect);
      tunnelProc.stderr.on('data', inspect);
      tunnelProc.on('exit', code => {
        tunnelProc = null;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`O túnel foi encerrado (${code ?? 'sem código'}).`));
        } else {
          sendHostStatus('tunnel-ended');
        }
      });
      tunnelProc.on('error', err => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  } catch (e) {
    await stopHosting();
    throw e;
  }
}

app.whenReady().then(() => {
  loadUpdateConfig();
  configureUpdater();
  const allowedPermissions = new Set(['media', 'display-capture', 'fullscreen', 'speaker-selection']);
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return allowedPermissions.has(permission) && isTrustedRenderer(webContents);
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowedPermissions.has(permission) && isTrustedRenderer(webContents));
  });

  ipcMain.handle('clipboard:write', (_event,text)=>{if(typeof text!=='string'||text.length>20000)throw new Error('Texto inválido.');clipboard.writeText(text);return true;});
  ipcMain.handle('external:open',async (_event,raw)=>{const url=safeExternalUrl(raw);if(!url)throw new Error('Link bloqueado.');await shell.openExternal(url);return true;});
  const registerShortcut = (accelerator, eventName) => {
    try { globalShortcut.register(accelerator, () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(eventName); }); } catch {}
  };
  registerShortcut('CommandOrControl+Shift+M', 'shortcut:mute');
  registerShortcut('CommandOrControl+Shift+D', 'shortcut:deafen');
  registerShortcut('CommandOrControl+Shift+S', 'shortcut:screen');

  createWindow();
  mainWindow.webContents.once('did-finish-load', () => { emitUpdateState(); scheduleAutomaticUpdateCheck(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => {

  try { globalShortcut.unregisterAll(); } catch {}
  if (tunnelProc) { try { tunnelProc.kill(); } catch {} }
  if (localServerHandle) { try { localServerHandle.server.close(); } catch {} }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
