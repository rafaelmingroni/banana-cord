const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'src', 'v214-private-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(index.includes('<script src="v214-private-ui-fix.js"></script>'), 'V2.0.14 private UI patch is not loaded.');
expect(/renderChannels\s*=\s*function[\s\S]*?if\s*\(state\.viewMode\s*===\s*['"]dm['"]\)\s*\{\s*renderDmSidebar\(\);\s*return;\s*\}[\s\S]*?return\s+renderChannelsBase\(\);/.test(ui), 'renderChannels must guard Privado before server rendering.');
expect(ui.includes('MutationObserver'), 'Privado self-healing observer is missing.');
expect(ui.includes('restoreServerReference'), 'Privado must preserve a server reference across reconnects.');
expect(ui.includes('Adicionar amigo'), 'Privado add-friend action is missing.');
expect(ui.includes('Nova mensagem'), 'Privado new-message action is missing.');
expect(ui.includes('Amigos'), 'Privado friends action is missing.');
expect(ui.includes('v214-private-home'), 'Privado home redesign is missing.');
expect(ui.includes('v214-private-request'), 'Friend-request indicator is missing.');

console.log('Banana Cord V2.0.14 private navigation/sidebar regression checks: OK');
