const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const STARTUP_ARG = '--banana-startup';
const SETTINGS_VERSION = 1;
const DEFAULTS = {
  version: SETTINGS_VERSION,
  startupInitialized: false,
  shareActivity: true,
  autoAwayMinutes: 5
};

const GAME_CATALOG = new Map(Object.entries({
  'rocketleague.exe': ['rocket-league', 'Rocket League'],
  'cs2.exe': ['counter-strike-2', 'Counter-Strike 2'],
  'gta5.exe': ['gta-v', 'Grand Theft Auto V'],
  'gta5_enhanced.exe': ['gta-v-enhanced', 'Grand Theft Auto V Enhanced'],
  'fortniteclient-win64-shipping.exe': ['fortnite', 'Fortnite'],
  'valorant-win64-shipping.exe': ['valorant', 'VALORANT'],
  'league of legends.exe': ['league-of-legends', 'League of Legends'],
  'dota2.exe': ['dota-2', 'Dota 2'],
  'overwatch.exe': ['overwatch-2', 'Overwatch 2'],
  'r5apex.exe': ['apex-legends', 'Apex Legends'],
  'rainbowsix.exe': ['rainbow-six-siege', 'Rainbow Six Siege'],
  'rainbowsix_vulkan.exe': ['rainbow-six-siege', 'Rainbow Six Siege'],
  'robloxplayerbeta.exe': ['roblox', 'Roblox'],
  'minecraft.windows.exe': ['minecraft', 'Minecraft'],
  'eldenring.exe': ['elden-ring', 'Elden Ring'],
  'eldenring_nightreign.exe': ['elden-ring-nightreign', 'Elden Ring Nightreign'],
  'bg3.exe': ['baldurs-gate-3', "Baldur's Gate 3"],
  'helldivers2.exe': ['helldivers-2', 'HELLDIVERS 2'],
  'cyberpunk2077.exe': ['cyberpunk-2077', 'Cyberpunk 2077'],
  'palworld-win64-shipping.exe': ['palworld', 'Palworld'],
  'cod.exe': ['call-of-duty', 'Call of Duty'],
  'cod22-cod.exe': ['call-of-duty', 'Call of Duty'],
  'destiny2.exe': ['destiny-2', 'Destiny 2'],
  'warframe.x64.exe': ['warframe', 'Warframe'],
  'warframe.exe': ['warframe', 'Warframe'],
  'ffxiv_dx11.exe': ['final-fantasy-xiv', 'FINAL FANTASY XIV'],
  'wow.exe': ['world-of-warcraft', 'World of Warcraft'],
  'wowclassic.exe': ['world-of-warcraft-classic', 'World of Warcraft Classic'],
  'pathofexile.exe': ['path-of-exile', 'Path of Exile'],
  'pathofexilesteam.exe': ['path-of-exile', 'Path of Exile'],
  'pathofexile_x64.exe': ['path-of-exile', 'Path of Exile'],
  'forzahorizon5.exe': ['forza-horizon-5', 'Forza Horizon 5'],
  'acmirage.exe': ['assassins-creed-mirage', "Assassin's Creed Mirage"],
  'fc26.exe': ['ea-sports-fc-26', 'EA SPORTS FC 26'],
  'fc25.exe': ['ea-sports-fc-25', 'EA SPORTS FC 25'],
  'eafc25.exe': ['ea-sports-fc-25', 'EA SPORTS FC 25']
}));

let settings = { ...DEFAULTS };
let idleSeconds = 0;
let idleState = 'active';
let activity = null;
let activityKey = '';
let idleTimer = null;
let activityTimer = null;

function settingsFile() {
  return path.join(app.getPath('userData'), 'v21-social-settings.json');
}

function loadSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    settings = {
      ...DEFAULTS,
      ...parsed,
      version: SETTINGS_VERSION,
      shareActivity: parsed.shareActivity !== false,
      autoAwayMinutes: Math.max(1, Math.min(60, Number(parsed.autoAwayMinutes || 5)))
    };
  } catch {
    settings = { ...DEFAULTS };
  }
  return settings;
}

function persistSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

function trustedRenderer(event) {
  try {
    const current = new URL(event?.sender?.getURL?.() || '');
    return current.protocol === 'file:' && current.pathname.endsWith('/src/index.html');
  } catch {
    return false;
  }
}

function loginOptions(openAtLogin) {
  return {
    openAtLogin: !!openAtLogin,
    path: process.execPath,
    args: [STARTUP_ARG],
    enabled: !!openAtLogin,
    name: 'Banana Cord'
  };
}

function startupStatus() {
  if (process.platform !== 'win32' || !app.isPackaged) return { supported: process.platform === 'win32', enabled: false };
  try {
    const row = app.getLoginItemSettings({ path: process.execPath, args: [STARTUP_ARG] });
    return {
      supported: true,
      enabled: row.executableWillLaunchAtLogin !== undefined ? !!row.executableWillLaunchAtLogin : !!row.openAtLogin,
      registered: !!row.openAtLogin
    };
  } catch {
    return { supported: true, enabled: false, registered: false };
  }
}

function ensureStartupDefaultOnce() {
  if (process.platform !== 'win32' || !app.isPackaged || settings.startupInitialized) return;
  try { app.setLoginItemSettings(loginOptions(true)); } catch (error) { console.warn('Banana Cord startup:', error?.message || error); }
  settings.startupInitialized = true;
  persistSettings();
}

function systemSnapshot() {
  return {
    idleSeconds,
    idleState,
    activity: settings.shareActivity ? activity : null,
    settings: {
      shareActivity: settings.shareActivity,
      autoAwayMinutes: settings.autoAwayMinutes,
      startup: startupStatus()
    },
    startupLaunch: process.argv.includes(STARTUP_ARG)
  };
}

function broadcast() {
  const payload = systemSnapshot();
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('banana-v21:system-state', payload);
    } catch {}
  }
}

function sampleIdle() {
  try {
    idleSeconds = Math.max(0, Number(powerMonitor.getSystemIdleTime()) || 0);
    idleState = String(powerMonitor.getSystemIdleState(Math.max(60, settings.autoAwayMinutes * 60)) || 'unknown');
  } catch {
    idleSeconds = 0;
    idleState = 'unknown';
  }
  broadcast();
}

function parseTasklist(stdout) {
  const names = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const match = line.match(/^"([^"]+)"/);
    if (match) names.push(match[1].toLowerCase());
  }
  return names;
}

function detectedGame(processNames) {
  for (const name of processNames || []) {
    const row = GAME_CATALOG.get(String(name || '').toLowerCase());
    if (row) return { id: row[0], name: row[1] };
  }
  return null;
}

async function scanActivity() {
  if (!settings.shareActivity || process.platform !== 'win32') {
    if (activity) { activity = null; activityKey = ''; broadcast(); }
    return;
  }
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/fo', 'csv', '/nh'], {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const found = detectedGame(parseTasklist(stdout));
    const key = found?.id || '';
    if (key === activityKey) return;
    activityKey = key;
    activity = found ? { ...found, startedAt: Date.now() } : null;
    broadcast();
  } catch (error) {
    console.warn('Banana Cord game activity:', error?.message || error);
  }
}

function startMonitoring() {
  clearInterval(idleTimer);
  clearInterval(activityTimer);
  sampleIdle();
  scanActivity();
  idleTimer = setInterval(sampleIdle, 5000);
  activityTimer = setInterval(scanActivity, 15000);
  idleTimer.unref?.();
  activityTimer.unref?.();
}

ipcMain.handle('banana-v21:get-settings', event => {
  if (!trustedRenderer(event)) throw new Error('Origem não autorizada.');
  return systemSnapshot();
});

ipcMain.handle('banana-v21:set-settings', async (event, next = {}) => {
  if (!trustedRenderer(event)) throw new Error('Origem não autorizada.');
  if (typeof next.shareActivity === 'boolean') {
    settings.shareActivity = next.shareActivity;
    if (!settings.shareActivity) { activity = null; activityKey = ''; }
  }
  if (next.autoAwayMinutes != null) settings.autoAwayMinutes = Math.max(1, Math.min(60, Number(next.autoAwayMinutes) || 5));
  if (typeof next.startupEnabled === 'boolean' && process.platform === 'win32' && app.isPackaged) {
    app.setLoginItemSettings(loginOptions(next.startupEnabled));
    settings.startupInitialized = true;
  }
  persistSettings();
  await scanActivity();
  sampleIdle();
  return systemSnapshot();
});

ipcMain.handle('banana-v21:get-system-languages', event => {
  if (!trustedRenderer(event)) throw new Error('Origem não autorizada.');
  try { return app.getPreferredSystemLanguages(); } catch { return [app.getLocale?.() || 'pt-BR']; }
});

app.whenReady().then(() => {
  loadSettings();
  ensureStartupDefaultOnce();
  startMonitoring();
  powerMonitor.on('lock-screen', () => { idleState = 'locked'; broadcast(); });
  powerMonitor.on('unlock-screen', () => { idleState = 'active'; idleSeconds = 0; broadcast(); });
});

app.on('browser-window-created', (_event, win) => {
  const startupLaunch = process.argv.includes(STARTUP_ARG);
  if (startupLaunch) {
    try { win.hide(); } catch {}
    win.once('ready-to-show', () => { try { win.hide(); } catch {} });
  }
  win.webContents.once('did-finish-load', () => setTimeout(broadcast, 100));
});

app.on('before-quit', () => {
  clearInterval(idleTimer);
  clearInterval(activityTimer);
});

module.exports = { parseTasklist, detectedGame, GAME_CATALOG, STARTUP_ARG };
