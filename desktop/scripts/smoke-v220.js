const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const expect = (ok, message) => { if (!ok) throw new Error(message); };

const pkg = JSON.parse(read('package.json'));
const index = read('src/index.html');
const css = read('src/v220-chat-stability.css');
const ui = read('src/v220-chat-stability.js');
const cloud = read('src/cloud-v2-v220-chat-stability.js');
const build = read('scripts/build-cloud-browser.js');

expect(pkg.version === '2.0.20', `expected 2.0.20, got ${pkg.version}`);
expect(index.includes('v220-chat-stability.css') && index.includes('v220-chat-stability.js'), 'V2.0.20 UI assets not loaded');
expect(build.includes("require('./cloud-v2-v220-chat-stability.js');"), 'V2.0.20 cloud patch not bundled');
expect(css.includes('height:100vh!important') && css.includes('overflow:hidden!important'), 'viewport lock missing');
expect(css.includes('.messages{min-height:0!important') && css.includes('overflow-y:auto!important'), 'message-only scrolling guard missing');
expect(cloud.includes("orderBy('createdAt', 'desc')"), 'history must query newest messages first');
expect(cloud.includes('const PAGE = 60'), 'initial history page must stay bounded at 60');
expect(cloud.includes('loadOlderMessagesV220') && cloud.includes('loadOlderDmV220'), 'progressive history loaders missing');
expect(cloud.includes('Math.min(MAX, current + PAGE)'), 'history must grow by bounded pages');
expect(ui.includes("els.messages?.addEventListener('scroll'"), 'scroll-triggered history loading missing');
expect(ui.includes('oldHeight') && ui.includes('scrollHeight - anchor.oldHeight'), 'scroll anchor preservation missing');
expect(pkg.scripts['smoke:cloud'].includes('smoke-v220.js'), 'V2.0.20 smoke not included in release regression');
expect(pkg.scripts['smoke:e2e-v2'].includes('e2e-v220-chat-ui.js'), 'V2.0.20 Electron stress test not included');

console.log('Banana Cord V2.0.20 chat stability checks: OK');
