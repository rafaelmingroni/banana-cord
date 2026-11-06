const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-v21-main-'));
app.setPath('userData', tempUserData);

ipcMain.handle('update:get-config', async () => ({ repoUrl:'', autoCheck:true, autoDownload:true, currentVersion:'2.1.0' }));
ipcMain.handle('update:get-state', async () => ({ status:'idle', progress:0, message:'' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => ({ phase:'idle', version:'2.1.0', percent:0 }));
ipcMain.handle('banana-updater:get-version', async () => '2.1.0');
ipcMain.handle('banana-updater:check', async () => ({ ok:true }));

const service = require('../v21-main.js');

const hardTimeout = setTimeout(() => {
  console.error('Banana Cord 2.1 main E2E failed: hard timeout');
  app.exit(1);
}, 20000);

function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  try { fs.rmSync(tempUserData, { recursive:true, force:true }); } catch {}
  setTimeout(() => app.exit(code), 50);
}
function fail(message) { finish(1, `Banana Cord 2.1 main E2E failed: ${message}`); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Keep the harness alive until its explicit success/failure exit code runs.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const sample = [
    '"explorer.exe","123","Console","1","10,000 K"',
    '"RocketLeague.exe","456","Console","1","500,000 K"',
    '"cs2.exe","789","Console","1","900,000 K"'
  ].join('\r\n');
  const parsed = service.parseTasklist(sample);
  if (!parsed.includes('rocketleague.exe') || !parsed.includes('cs2.exe')) return fail(`tasklist parser mismatch: ${JSON.stringify(parsed)}`);
  const game = service.detectedGame(parsed);
  if (game?.id !== 'rocket-league' || game?.name !== 'Rocket League') return fail(`game detection mismatch: ${JSON.stringify(game)}`);
  if (service.detectedGame(['javaw.exe']) !== null) return fail('generic Java process must not be classified as Minecraft');
  const idle = Number(powerMonitor.getSystemIdleTime());
  if (!Number.isFinite(idle) || idle < 0) return fail(`invalid system idle time: ${idle}`);

  const win = new BrowserWindow({
    show:false,
    width:1000,
    height:700,
    webPreferences:{preload:path.join(__dirname,'..','preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true }
  });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(250);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const first = await window.MingrxDesktop.ipcRenderer.invoke('banana-v21:get-settings');
      const second = await window.MingrxDesktop.ipcRenderer.invoke('banana-v21:set-settings', {
        shareActivity:false,
        autoAwayMinutes:10
      });
      const languages = await window.MingrxDesktop.ipcRenderer.invoke('banana-v21:get-system-languages');
      return { first, second, languages };
    })();
  `, true);

  if (result?.first?.settings?.shareActivity !== true) return fail(`activity must default on: ${JSON.stringify(result)}`);
  if (result?.first?.settings?.autoAwayMinutes !== 5) return fail(`auto-away must default to 5 minutes: ${JSON.stringify(result)}`);
  if (result?.second?.settings?.shareActivity !== false || result?.second?.settings?.autoAwayMinutes !== 10) return fail(`settings IPC did not persist: ${JSON.stringify(result)}`);
  if (!Array.isArray(result?.languages) || !result.languages.length) return fail('system languages IPC returned no languages');

  const settingsPath = path.join(tempUserData, 'v21-social-settings.json');
  if (!fs.existsSync(settingsPath)) return fail('V2.1 settings file was not persisted');
  const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (saved.shareActivity !== false || saved.autoAwayMinutes !== 10) return fail(`saved settings mismatch: ${JSON.stringify(saved)}`);

  try { win.destroy(); } catch {}
  finish(0, `Banana Cord 2.1 main Electron service test: OK (idle=${idle}s, game=${game.name})`);
}).catch(error => fail(error?.stack || error?.message || String(error)));
