const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`V2.0.17+ smoke failed: ${message}`);
};
const versionAtLeast = (actual, minimum) => {
  const a = String(actual).split('.').map(Number);
  const b = String(minimum).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av !== bv) return av > bv;
  }
  return true;
};

const updater = read('updater-prompt.js');
const ui = read('src/v217-premium-updater.js');
const css = read('src/v217-premium-updater.css');
const html = read('src/index.html');
const pkg = JSON.parse(read('package.json'));

assert(versionAtLeast(pkg.version, '2.0.17'), 'package version must be 2.0.17 or newer');
assert(updater.includes('autoUpdater.autoDownload = true'), 'automatic background download must remain enabled');
assert(updater.includes('autoUpdater.autoInstallOnAppQuit = false'), 'visible/implicit install-on-quit path must stay disabled');
assert(
  updater.includes('isSilent: true') && updater.includes('isForceRunAfter: true'),
  'explicit updater install must be silent and reopen the app'
);
assert(!updater.includes('dialog.showMessageBox'), 'native Windows update dialogs must not return');
assert(updater.includes("ipcMain.handle('banana-updater:get-state'"), 'renderer must be able to recover updater state after load');
assert(updater.includes("win.webContents.send('banana-updater:state'"), 'main process must stream updater state to the UI');
assert(ui.includes("ipcRenderer.on('banana-updater:state'"), 'premium UI must receive live updater state');
assert(ui.includes("ipcRenderer.send('banana-updater:install'"), 'premium UI must trigger explicit silent install');
assert(ui.includes('Atualizar agora') && ui.includes('Depois'), 'ready state actions must exist');
assert(ui.includes('Aplicando atualização...'), 'in-app installation transition screen must exist');
assert(ui.includes("localStorage.setItem('banana.lastVersion'"), 'successful update acknowledgement must remember current version');
assert(css.includes('.banana-updater-card') && css.includes('.banana-updater-overlay'), 'premium updater visuals must be present');
assert(html.includes('v217-premium-updater.css'), 'premium updater stylesheet must load');
assert(html.includes('v217-premium-updater.js'), 'premium updater renderer must load');
assert(pkg.scripts['smoke:cloud'].includes('smoke-v217.js'), 'V2.0.17 smoke must run in release parity tests');

console.log('V2.0.17+ premium updater smoke passed.');
