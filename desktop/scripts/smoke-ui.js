const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const hotfix = fs.readFileSync(path.join(root, 'src', 'v101-fix.js'), 'utf8');
const tray = fs.readFileSync(path.join(root, 'tray.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function assert(ok, message) {
  if (!ok) {
    console.error(`UI smoke test failed: ${message}`);
    process.exit(1);
  }
}

for (const file of ['main-v110.js', 'rendezvous.js', 'tray.js', 'updater-prompt.js', 'src/v101-fix.js', 'src/v1.js', 'src/v110.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

assert(/^1\.1\./.test(pkg.version), 'package version must be in the 1.1 line');
assert(!/p[oó]s-beta/i.test(index), 'index.html must not show pós-beta');
assert(index.includes('v101-fix.js'), 'renderer stability guard must be loaded');
assert(index.includes('v110.js'), 'v1.1 renderer must be loaded');
assert(index.indexOf('v101-fix.js') < index.indexOf('v1.js'), 'stability guard must load before v1.js');
assert(index.indexOf('v1.js') < index.indexOf('v110.js'), 'v1.1 renderer must load after v1.js');
assert(hotfix.includes("this.matches('.version-label')"), 'version-label recursion guard missing');
assert(hotfix.includes('current === String(next)'), 'same-value textContent guard missing');
assert(tray.includes("banana-tray.png"), 'dedicated tray icon missing');
assert(!tray.includes('.crop({ x, y, width: cropSize, height: cropSize })'), 'old tray crop workaround should be removed');
assert(index.includes('continua na bandeja'), 'host tray behavior should be explained');
assert(index.includes('ABCD-EFGH'), 'short invite example should be visible');

console.log(`Banana Cord v${pkg.version} UI smoke test: OK`);
