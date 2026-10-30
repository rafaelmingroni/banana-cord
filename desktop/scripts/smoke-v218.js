const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const expect = (ok, message) => { if (!ok) throw new Error(message); };

const pkg = JSON.parse(read('package.json'));
const index = read('src/index.html');
const css = read('src/v218-polish.css');
const ui = read('src/v218-polish.js');
const e2eeUi = read('src/v216-e2ee-ui.js');
const updater = read('updater-prompt.js');
const shutdown = read('graceful-shutdown.js');

expect(pkg.version === '2.0.18', `expected package version 2.0.18, got ${pkg.version}`);
expect(pkg.build?.nsis?.oneClick === true, 'NSIS must be one-click in V2.0.18');
expect(pkg.build?.nsis?.perMachine === false, 'NSIS must remain per-user in V2.0.18');
expect(pkg.build?.nsis?.allowToChangeInstallationDirectory !== true, 'one-click installer must not expose directory wizard');
expect(index.includes('v218-polish.css') && index.includes('v218-polish.js'), 'V2.0.18 assets are not loaded');
expect(css.includes('grid-column:3 / -1!important'), 'DM responsive grid fix missing');
expect(css.includes('.app.dm-mode .composer') && css.includes('flex:0 0 auto'), 'DM composer visibility guard missing');
expect(ui.includes('Chamada privada recebida'), 'incoming call UI missing');
expect(ui.includes('Recusar') && ui.includes('Atender'), 'incoming call actions missing');
expect(ui.includes('setInterval(ringOnce, 1800)'), 'incoming call ringtone loop missing');
expect(ui.includes('Em chamada com'), 'active call state label missing');
expect(ui.includes('está falando') && ui.includes('Você está falando'), 'speaking clarity text missing');
expect(ui.includes("ipcRenderer.send('banana-call:attention', true)"), 'Windows attention request missing');
expect(!e2eeUi.includes('O Firebase recebe somente conteúdo cifrado'), 'technical Firebase wording leaked into user-facing E2EE banner');
expect(e2eeUi.includes('Só você e seu contato conseguem ler'), 'plain-language E2EE explanation missing');
expect(updater.includes('autoUpdater.autoInstallOnAppQuit = false'), 'automatic install on quit must stay disabled');
expect(updater.includes('isSilent: true') && updater.includes('isForceRunAfter: true'), 'explicit silent updater options missing');
expect(!updater.includes('quitAndInstall(true, true)'), 'legacy quitAndInstall boolean call must not return');
expect(shutdown.includes("typeof options === 'object'"), 'graceful updater wrapper must preserve object options');
expect(!updater.includes('showMessageBox'), 'native installer/update prompts must not return');

console.log('Banana Cord V2.0.18 polish/updater regression checks: OK');
