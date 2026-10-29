const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const hotfix = fs.readFileSync(path.join(root, 'src', 'v101-fix.js'), 'utf8');
const runtimeFix = fs.readFileSync(path.join(root, 'src', 'cloud-v2-runtime-fixes.js'), 'utf8');
const runtimeCss = fs.readFileSync(path.join(root, 'src', 'cloud-v2-runtime-fixes.css'), 'utf8');
const tray = fs.readFileSync(path.join(root, 'tray.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const v120 = fs.readFileSync(path.join(root, 'src', 'v120.js'), 'utf8');

function assert(ok, message) {
  if (!ok) { console.error(`UI smoke test failed: ${message}`); process.exit(1); }
}

for (const file of ['main-v120.js','main-v110.js','rendezvous.js','tray.js','updater-prompt.js','src/v101-fix.js','src/v1.js','src/v110.js','src/v120.js','src/cloud-v2.js','src/cloud-v2-auth-fix.js','src/cloud-v2-ui-fix.js','src/cloud-v2-legacy-bridge.js','src/cloud-v2-socket.js','src/cloud-v2-runtime-fixes.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

assert(pkg.version === '1.2.1' || /^2\.0\.0-cloud\./.test(pkg.version), 'package version must be stable 1.2.1 or a v2 cloud preview');
assert(pkg.main === 'main-v120.js', 'deep-link entry must remain enabled during cloud migration');
assert((pkg.build?.protocols || []).some(p => (p.schemes || []).includes('bananacord')), 'bananacord:// protocol registration missing');
assert(!/p[oó]s-beta/i.test(index), 'index.html must not show pós-beta');
assert(index.includes('v101-fix.js'), 'renderer stability guard must be loaded');
assert(index.includes('v110.js') && index.includes('v120.js'), 'v1.1 and v1.2 renderers must remain loaded during migration');
assert(index.indexOf('v101-fix.js') < index.indexOf('v1.js'), 'stability guard must load before v1.js');
assert(index.indexOf('v110.js') < index.indexOf('v120.js'), 'v1.2 renderer must load after v1.1');
assert(hotfix.includes("this.matches('.version-label, .settings-nav-foot, .setup .brand p b')"), 'version recursion guard missing');
assert(hotfix.includes('normalizedVersionText') && hotfix.includes('current === next'), 'cloud-aware same-value textContent guard missing');
assert(hotfix.includes("return 'Banana Cord v2 Cloud Preview'") && hotfix.includes("return 'v2 Cloud Preview'"), 'cloud version normalization missing');
assert(!hotfix.includes("VERSION = '1.1.1'"), 'stability guard must not pin an old version');
assert(tray.includes('banana-tray.png'), 'dedicated tray icon missing');
assert(index.includes('ABCD-EFGH'), 'short invite compatibility missing');
assert(v120.includes('https://rafaelmingroni.github.io/banana-cord/?invite='), 'public invite link base missing');
assert(v120.includes("ipcRenderer.on('invite:deep-link'"), 'renderer deep-link listener missing');
assert(v120.includes('lead && lead.textContent !== INVITE_LEAD'), 'invite lead must be idempotent inside MutationObserver');
assert(v120.includes('enhancementQueued'), 'invite MutationObserver must coalesce DOM changes');
assert(!v120.includes('if (lead) lead.textContent ='), 'unconditional invite lead mutation can freeze the renderer');

if (/^2\.0\.0-cloud\./.test(pkg.version)) {
  const cloudBundle = 'cloud-browser/cloud-v2-all.browser.js';
  assert(index.includes(cloudBundle), 'v2 unified cloud browser bundle missing');
  assert(index.includes('cloud-v2-legacy-bridge.js'), 'v2 stable UI compatibility bridge missing');
  assert(index.includes('cloud-v2-runtime-fixes.css'), 'cloud runtime UX stylesheet missing');
  assert(index.includes('cloud-v2-runtime-fixes.js'), 'cloud runtime UX script missing');
  assert(index.indexOf(cloudBundle) < index.indexOf('cloud-v2-runtime-fixes.js'), 'runtime fixes must load after unified cloud bundle');
  assert(runtimeCss.includes('overflow-y:auto') && runtimeCss.includes('height:min(680px,86vh)'), 'settings scroll fix missing');
  assert(runtimeFix.includes('self-share-safe') && runtimeFix.includes('video.srcObject = null'), 'recursive self-share guard missing');
  assert(runtimeFix.includes('remoteShare') && !runtimeFix.includes('autoFocusShare && anyShare'), 'local share must not trigger automatic focus');
  assert(!index.includes('cloud-v2-home.js'), 'simplified cloud home must not replace v1.2.1 UI');
  assert(!index.includes('cloud-v2.browser.js') && !index.includes('cloud-v2-auth-fix.browser.js') && !index.includes('cloud-v2-socket.browser.js'), 'legacy split Firebase bundles must not return');
  assert(index.indexOf('v1.js') < index.indexOf('cloud-v2-legacy-bridge.js'), 'cloud bridge must load after mature v1 renderer');
  assert(index.indexOf('cloud-v2-legacy-bridge.js') < index.indexOf('v110.js'), 'cloud mode must be active before invite extensions');
  assert(index.indexOf('v120.js') < index.indexOf(cloudBundle), 'unified Firebase cloud layer must load after stable renderers');
}

console.log(`Banana Cord v${pkg.version} UI smoke test: OK`);
