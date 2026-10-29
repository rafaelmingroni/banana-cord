const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const nav = fs.readFileSync(path.join(root, 'src', 'v205-navigation-fix.js'), 'utf8');
const del = fs.readFileSync(path.join(root, 'src', 'v205-server-delete-fix.js'), 'utf8');
const social = fs.readFileSync(path.join(root, 'src', 'v206-social-fix.js'), 'utf8');
const socialUi = fs.readFileSync(path.join(root, 'src', 'v206-social-ui-fix.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

new Function(nav);
new Function(del);
new Function(social);
new Function(socialUi);

assert(nav.includes('selectServerV205'), 'V2.0.5 must override server navigation.');
assert(!nav.includes('leaveVoice()'), 'Browsing servers must not leave the active voice call.');
assert(nav.includes("state.socket.emit('members:get'"), 'Navigation must still load the selected server members.');

const messagesAt = del.indexOf("collection(this.db, 'servers', serverId, 'channels', channel.id, 'messages')");
const channelsAt = del.indexOf("channels.docs.slice(i, i + 400).forEach(channel => batch.delete(channel.ref))");
const originalAt = del.indexOf('return originalDeleteServer(serverId)');
assert(messagesAt >= 0 && channelsAt > messagesAt, 'Messages must be removed before channels.');
assert(originalAt > channelsAt, 'Protected channels must be removed before the original member/server cleanup.');
assert(del.includes("role !== 'owner'"), 'Only the server owner may use the deletion fix.');

assert(social.includes("where('participants', 'array-contains', this.user.uid)"), 'Relationship lookup must query only the caller relationships.');
assert(!social.includes('Vocês precisam estar em um servidor em comum'), 'Friend requests must not require a shared server.');
assert(social.includes("event === 'friend:search'"), 'Backend must support user search.');
assert(social.includes("event === 'friend:request'"), 'Friend request must acknowledge success/failure to the UI.');
assert(social.includes('searchName'), 'Searchable normalized usernames must be maintained.');
const dmCreateAt = social.indexOf("setDoc(doc(this.db, 'dmThreads', tid)");
const dmWatchAt = social.indexOf('return originalWatchDm(peerId)');
assert(dmCreateAt >= 0 && dmWatchAt > dmCreateAt, 'A new DM thread must exist before the original messages watcher starts.');

assert(socialUi.includes('Adicionar amigo'), 'DM/onboarding UI must expose Add friend.');
assert(socialUi.includes('Criar ou entrar em um servidor'), 'First-run UI must expose a clear server CTA.');
assert(socialUi.includes('v1?.social?.friends'), 'New DM picker must include accepted friends outside the current server.');

assert(index.includes('v205-navigation-fix.js'), 'Index must load V2.0.5 navigation fix.');
assert(index.includes('v205-server-delete-fix.js'), 'Index must load V2.0.5 server deletion fix.');
assert(index.includes('v206-social-fix.js'), 'Index must load V2.0.6 social backend fix.');
assert(index.includes('v206-social-ui-fix.js'), 'Index must load V2.0.6 social/onboarding UI fix.');

console.log('Banana Cord V2.0.6 regression checks: OK');
