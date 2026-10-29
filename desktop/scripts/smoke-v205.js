const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const nav = fs.readFileSync(path.join(root, 'src', 'v205-navigation-fix.js'), 'utf8');
const del = fs.readFileSync(path.join(root, 'src', 'v205-server-delete-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

// Compile the runtime patches without executing browser globals.
new Function(nav);
new Function(del);

assert(nav.includes('selectServerV205'), 'V2.0.5 must override server navigation.');
assert(!nav.includes('leaveVoice()'), 'Browsing servers must not leave the active voice call.');
assert(nav.includes("state.socket.emit('members:get'"), 'Navigation must still load the selected server members.');

const messagesAt = del.indexOf("collection(this.db, 'servers', serverId, 'channels', channel.id, 'messages')");
const channelsAt = del.indexOf("channels.docs.slice(i, i + 400).forEach(channel => batch.delete(channel.ref))");
const originalAt = del.indexOf('return originalDeleteServer(serverId)');
assert(messagesAt >= 0 && channelsAt > messagesAt, 'Messages must be removed before channels.');
assert(originalAt > channelsAt, 'Protected channels must be removed before the original member/server cleanup.');
assert(del.includes("role !== 'owner'"), 'Only the server owner may use the deletion fix.');

assert(index.includes('v205-navigation-fix.js'), 'Index must load V2.0.5 navigation fix.');
assert(index.includes('v205-server-delete-fix.js'), 'Index must load V2.0.5 server deletion fix.');

console.log('Banana Cord V2.0.5 regression checks: OK');
