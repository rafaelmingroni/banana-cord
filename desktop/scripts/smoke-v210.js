const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const patch = fs.readFileSync(path.join(root, 'src', 'v210-server-delete-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(patch);
assert.strictEqual(pkg.version, '2.0.10', 'V2.0.10 package version must be set.');
assert(index.includes('v210-server-delete-ui-fix.js'), 'Renderer must load the V2.0.10 delete UI fix.');
assert(patch.includes("label.includes('Excluir servidor')"), 'Delete menu click must be intercepted.');
assert(patch.includes('openDeleteModal(server)'), 'Delete click must open the in-app confirmation modal.');
assert(patch.includes("state.socket.emit('server:delete'"), 'Confirmed modal must emit server:delete.');
assert(!patch.includes('prompt('), 'V2.0.10 delete flow must not depend on native prompt().');
assert(patch.includes('stopImmediatePropagation'), 'Legacy prompt handler must be blocked before bubbling.');

console.log('Banana Cord V2.0.10 server delete UI regression checks: OK');
