const { app, BrowserWindow, session, desktopCapturer, ipcMain, clipboard, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { startBananaServer } = require('./server/server');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let localServerHandle = null;
let tunnelProc = null;
let tunnelUrl = '';
const DEFAULT_UPDATE_REPO = 'https://github.com/rafaelmingroni/banana-cord';
let updateConfig = { repoUrl: DEFAULT_UPDATE_REPO, autoCheck: true, autoDownload: true };
let updateState = { status: 'idle', currentVersion: '', latestVersion: '', progress: 0, message: '' };
let updaterEventsBound = false;
let updateCheckTimer = null;

function sendHostStatus(status, extra = {}) {
  const payload = { status, ...extra };
  app.emit('banana:host-status', payload);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('host:status', payload);
}

function updateConfigFile() {
  return path.join(app.getPath('userData'), 'update-config.json');
}

function normalizeGithubRepoUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (!['github.com', 'www.github.com'].includes(u.hostname.toLowerCase())) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
  } catch {
    return '';
  }
}

function repoParts(repoUrl) {
  const clean = normalizeGithubRepoUrl(repoUrl);
  if (!clean) return null;
  const u = new URL(clean);
  const [owner, repo] = u.pathname.split('/').filter(Boolean);
  return owner && repo ? { owner, repo } : null;
}

function loadUpdateConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(updateConfigFile(), 'utf8'));
    updateConfig = {
      repoUrl: normalizeGithubRepoUrl(parsed.repoUrl) || DEFAULT_UPDATE_REPO,
      autoCheck: parsed.autoCheck !== false,
      autoDownload: parsed.autoDownload !== false
    };
  } catch {
    updateConfig = { repoUrl: DEFAULT_UPDATE_REPO, autoCheck: true, autoDownload: true };
  }
  return updateConfig;
}

function persistUpdateConfig(next = {}) {
  const merged = {
    repoUrl: normalizeGithubRepoUrl(next.repoUrl ?? updateConfig.repoUrl),
    autoCheck: next.autoCheck ?? updateConfig.autoCheck,
    autoDownload: next.autoDownload ?? updateConfig.autoDownload
  };
  updateConfig = { repoUrl: merged.repoUrl, autoCheck: !!merged.autoCheck, autoDownload: !!merged.autoDownload };
  fs.mkdirSync(path.dirname(updateConfigFile()), { recursive: true });
  fs.writeFileSync(updateConfigFile(), JSON.stringify(updateConfig, null, 2));
  configureUpdater();
  return updateConfig;
}

function emitUpdateState(patch = {}) {
  updateState = {
    ...updateState,
    currentVersion: app.getVersion(),
    configured: !!repoParts(updateConfig.repoUrl),
    repoUrl: updateConfig.repoUrl,
    autoCheck: updateConfig.autoCheck,
    autoDownload: updateConfig.autoDownload,
    ...patch
  };
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:state', updateState);
  return updateState;
}

function bindUpdaterEvents() {
  if (updaterEventsBound) return;
  updaterEventsBound = true;
  autoUpdater.logger = console;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => emitUpdateState({ status: 'checking', progress: 0, message: 'Verificando atualizações…' }));
  autoUpdater.on('update-available', info => emitUpdateState({ status: updateConfig.autoDownload ? 'downloading' : 'available', latestVersion: info?.version || '', progress: 0, message: `Banana Cord ${info?.version || 'novo'} disponível.` }));
  autoUpdater.on('update-not-available', info => emitUpdateState({ status: 'up-to-date', latestVersion: info?.version || app.getVersion(), progress: 100, message: 'Banana Cord está atualizado.' }));
  autoUpdater.on('download-progress', p => emitUpdateState({ status: 'downloading', progress: Math.max(0, Math.min(100, Number(p?.percent || 0))), message: `Baixando atualização… ${Math.round(Number(p?.percent || 0))}%` }));
  autoUpdater.on('update-downloaded', info => emitUpdateState({ status: 'downloaded', latestVersion: info?.version || '', progress: 100, message: 'Atualização pronta. Reinicie para instalar.' }));
  autoUpdater.on('error', err => emitUpdateState({ status: 'error', progress: 0, message: String(err?.message || err || 'Falha ao atualizar.') }));
}

function configureUpdater() {
  bindUpdaterEvents();
  autoUpdater.autoDownload = !!updateConfig.autoDownload;
  const parts = repoParts(updateConfig.repoUrl);
  if (!parts) return emitUpdateState({ status: 'not-configured', message: 'Fonte de atualizações não configurada.' });
  try {
    autoUpdater.setFeedURL({ provider: 'github', owner: parts.owner, repo: parts.repo, private: false });
    return emitUpdateState({ status: updateState.status === 'not-configured' ? 'idle' : updateState.status, message: updateState.status === 'not-configured' ? 'Atualizações configuradas.' : updateState.message });
  } catch (err) {
    return emitUpdateState({ status: 'error', message: `Não consegui configurar atualizações: ${err?.message || err}` });
  }
}

async function checkForUpdates(manual = false) {
  const parts = repoParts(updateConfig.repoUrl);
  if (!parts) return emitUpdateState({ status: 'not-configured', message: 'Configure um repositório público do GitHub para receber atualizações.' });
  if (!app.isPackaged) return emitUpdateState({ status: 'dev', message: 'A verificação automática funciona no Banana Cord instalado (.exe).' });
  try {
    configureUpdater();
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    emitUpdateState({ status: 'error', message: String(err?.message || err || 'Falha ao verificar atualizações.') });
    if (manual) throw err;
    return null;
  }
}

function scheduleAutomaticUpdateCheck() {
  clearTimeout(updateCheckTimer);
  if (!updateConfig.autoCheck || !repoParts(updateConfig.repoUrl)) return;
  updateCheckTimer = setTimeout(() => checkForUpdates(false), 6500);
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
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Muitos redirecionamentos.'));
    const request = https.get(url, { headers: { 'User-Agent': 'BananaCord/0.10' } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        const next = new URL(response.headers.location, url).toString();
        response.resume();
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
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission));
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowedPermissions.has(permission));
  });

  if (session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true });
        if (!sources.length) return callback({});
        callback({ video: sources[0], audio: process.platform === 'win32' ? 'loopback' : undefined });
      } catch {
        callback({});
      }
    }, { useSystemPicker: true });
  }

  ipcMain.handle('host:start', startHosting);
  ipcMain.handle('host:stop', stopHosting);
  ipcMain.handle('host:status', () => ({ running: !!localServerHandle, url: tunnelUrl, localUrl: localServerHandle ? 'http://127.0.0.1:3210' : '' }));
  ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text || '')); return true; });
  ipcMain.handle('update:get-state', () => emitUpdateState());
  ipcMain.handle('update:get-config', () => ({ ...updateConfig, currentVersion: app.getVersion() }));
  ipcMain.handle('update:save-config', (_e, cfg) => {
    const requested = String(cfg?.repoUrl || '').trim();
    if (requested && !normalizeGithubRepoUrl(requested)) throw new Error('Use um endereço público no formato https://github.com/usuario/repositorio');
    const saved = persistUpdateConfig(cfg || {});
    scheduleAutomaticUpdateCheck();
    return { ...saved, currentVersion: app.getVersion() };
  });
  ipcMain.handle('update:check', async () => { await checkForUpdates(true); return emitUpdateState(); });
  ipcMain.handle('update:download', async () => {
    if (!app.isPackaged) return emitUpdateState({ status: 'dev', message: 'Downloads de atualização só funcionam no app instalado.' });
    await autoUpdater.downloadUpdate();
    return emitUpdateState();
  });
  ipcMain.handle('update:install', () => {
    if (updateState.status !== 'downloaded') return false;
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return true;
  });

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
  clearTimeout(updateCheckTimer);
  try { globalShortcut.unregisterAll(); } catch {}
  if (tunnelProc) { try { tunnelProc.kill(); } catch {} }
  if (localServerHandle) { try { localServerHandle.server.close(); } catch {} }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
