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

for (const file of ['tray.js', 'updater-prompt.js', 'src/v101-fix.js', 'src/v1.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

assert(pkg.version === '1.0.1', 'package version must be 1.0.1');
assert(!/p[oó]s-beta/i.test(index), 'index.html must not show pós-beta');
assert(index.includes('v101-fix.js'), 'renderer hotfix must be loaded');
assert(index.indexOf('v101-fix.js') < index.indexOf('v1.js'), 'renderer hotfix must load before v1.js');
assert(hotfix.includes("this.matches('.version-label')"), 'version-label recursion guard missing');
assert(hotfix.includes('current === String(next)'), 'same-value textContent guard missing');
assert(tray.includes('.crop({ x, y, width: cropSize, height: cropSize })'), 'tray icon visibility crop missing');
assert(index.includes('continua na bandeja'), 'host tray behavior should be explained');

console.log('Banana Cord v1.0.1 UI smoke test: OK');
