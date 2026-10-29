const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const hotfix = fs.readFileSync(path.join(root, 'src', 'v101-fix.js'), 'utf8');
const tray = fs.readFileSync(path.join(root, 'tray.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const v120 = fs.readFileSync(path.join(root, 'src', 'v120.js'), 'utf8');

function assert(ok, message) {
  if (!ok) {
    console.error(`UI smoke test failed: ${message}`);
    process.exit(1);
  }
}

for (const file of ['main-v120.js', 'main-v110.js', 'rendezvous.js', 'tray.js', 'updater-prompt.js', 'src/v101-fix.js', 'src/v1.js', 'src/v110.js', 'src/v120.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

assert(/^1\.2\./.test(pkg.version), 'package version must be in the 1.2 line');
assert(pkg.main === 'main-v120.js', 'v1.2 main entry must handle deep links');
assert((pkg.build?.protocols || []).some(p => (p.schemes || []).includes('bananacord')), 'bananacord:// protocol registration missing');
assert(!/p[oó]s-beta/i.test(index), 'index.html must not show pós-beta');
assert(index.includes('v101-fix.js'), 'renderer stability guard must be loaded');
assert(index.includes('v110.js') && index.includes('v120.js'), 'v1.1 and v1.2 renderers must be loaded');
assert(index.indexOf('v101-fix.js') < index.indexOf('v1.js'), 'stability guard must load before v1.js');
assert(index.indexOf('v110.js') < index.indexOf('v120.js'), 'v1.2 renderer must load last');
assert(hotfix.includes("this.matches('.version-label')"), 'version-label recursion guard missing');
assert(hotfix.includes('current === String(next)'), 'same-value textContent guard missing');
assert(tray.includes("banana-tray.png"), 'dedicated tray icon missing');
assert(index.includes('continua na bandeja'), 'host tray behavior should be explained');
assert(index.includes('ABCD-EFGH'), 'short invite example should be visible');
assert(v120.includes('https://rafaelmingroni.github.io/banana-cord/?invite='), 'public invite link base missing');
assert(v120.includes("ipcRenderer.on('invite:deep-link'"), 'renderer deep-link listener missing');

console.log(`Banana Cord v${pkg.version} UI smoke test: OK`);
