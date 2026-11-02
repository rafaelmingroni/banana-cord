const fs = require('fs');
const path = require('path');

const main = fs.readFileSync(path.join(__dirname, '..', 'main-v120.js'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(/setZoomFactor\(1\)/.test(main), 'Mingrx main process must force renderer zoom to 100%.');
expect(/before-input-event/.test(main), 'Mingrx main process must guard browser zoom shortcuts.');
expect(/\['\+',\s*'=',\s*'-',\s*'_',\s*'0'\]/.test(main), 'Mingrx zoom shortcut guard is incomplete.');
expect(/browser-window-created[\s\S]*enforceRendererScale/.test(main), 'Mingrx renderer scale guard must be attached to every app window.');

console.log('Mingrx renderer 100% scale regression smoke: OK');
