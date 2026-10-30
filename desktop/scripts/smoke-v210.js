const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const patch = fs.readFileSync(path.join(root, 'src', 'v210-server-delete-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(patch);
const [major, minor, patchVersion] = String(pkg.version || '').split('.').map(Number);
assert(major > 2 || (major === 2 && (minor > 0 || (minor === 0 && patchVersion >= 10))), 'V2.0.10 delete regression must remain enabled in V2.0.10 or newer.');
assert(index.includes('v210-server-delete-ui-fix.js'), 'Renderer must load the V2.0.10 delete UI fix.');
assert(patch.includes("label.includes('Excluir servidor')"), 'Delete menu click must be intercepted.');
assert(patch.includes('openDeleteModal(server)'), 'Delete click must open the in-app confirmation modal.');
assert(patch.includes("state.socket.emit('server:delete'"), 'Confirmed modal must emit server:delete.');
assert(!patch.includes('prompt('), 'V2.0.10 delete flow must not depend on native prompt().');
assert(patch.includes('stopImmediatePropagation'), 'Legacy prompt handler must be blocked before bubbling.');

console.log(`Banana Cord ${pkg.version} preserves the V2.0.10 server delete UI regression: OK`);
