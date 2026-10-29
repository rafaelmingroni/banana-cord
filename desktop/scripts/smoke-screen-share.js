const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const renderer = read('src/screen-share-fix.js');
const mainFix = read('screen-share-main-fix.js');
const index = read('src/index.html');
const updater = read('updater-prompt.js');
const pkg = JSON.parse(read('package.json'));

// Syntax guards for both compatibility layers.
new Function(renderer);
new Function(mainFix);

assert(renderer.includes('audio: true'), 'screen share should first request system audio');
assert(renderer.includes('audio: false'), 'screen share should retry video-only');
assert(renderer.includes("removeAllListeners('shortcut:screen')"), 'screen shortcut should use compatibility handler');
assert(renderer.includes('Não consegui compartilhar a tela (${code})'), 'screen failures should expose an error code');

assert(mainFix.includes("startsWith('screen:')"), 'main handler should prioritize real screen sources');
assert(mainFix.includes('request?.audioRequested'), 'loopback audio should only be granted when requested');
assert(mainFix.includes("streams.audio = 'loopback'"), 'Windows loopback audio should remain available');
assert(mainFix.includes('useSystemPicker: false'), 'Windows capture should not depend on the experimental picker');

assert(index.includes('<script src="screen-share-fix.js"></script>'), 'renderer screen-share fix must be loaded');
assert(updater.includes("require('./screen-share-main-fix.js')"), 'main screen-share fix must be loaded');
assert(pkg.build.files.includes('screen-share-main-fix.js'), 'packaged app must include main screen-share fix');

console.log('Screen-share compatibility smoke test OK.');
