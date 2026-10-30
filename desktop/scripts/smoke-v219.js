const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const expect = (ok, message) => { if (!ok) throw new Error(message); };
const versionAtLeast = (actual, minimum) => {
  const a = String(actual).split('.').map(Number);
  const b = String(minimum).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av !== bv) return av > bv;
  }
  return true;
};

const pkg = JSON.parse(read('package.json'));
const html = read('src/index.html');
const js = read('src/v219-details.js');
const css = read('src/v219-details.css');

expect(versionAtLeast(pkg.version, '2.0.19'), `expected package version 2.0.19 or newer, got ${pkg.version}`);
expect(html.includes('v219-details.css') && html.includes('v219-details.js'), 'V2.0.19 detail assets are not loaded');
expect(js.includes('Hoje —') && js.includes('Ontem —'), 'today/yesterday labels missing');
expect(js.includes('1 semana atrás') && js.includes('fullDate'), 'older date context missing');
expect(js.includes("decorateMessageDates(list, '.message:not(.dm-message)')"), 'server message date dividers missing');
expect(js.includes("decorateMessageDates(list, '.dm-message')"), 'DM date dividers missing');
expect(js.includes('ROLE_GROUP') && js.includes('Administradores') && js.includes('Moderadores'), 'hierarchy groups missing');
expect(js.includes("state.socket.emit('member:set-role'"), 'role assignment action missing');
expect(js.includes('DEFAULT_ROLE_COLORS') && js.includes('persistRoleColors'), 'persistent role color system missing');
expect(js.includes("roleColors: safe") && js.includes('serverTimestamp'), 'role colors are not saved to server document');
expect(js.includes('applyMessageRoleColors') && js.includes("name.dataset.role = role"), 'chat author role coloring missing');
expect(js.includes('v219-role-color-input') && js.includes('type="color"'), 'role color picker missing');
expect(js.includes('v219-profile-card') && js.includes('Membro desde'), 'richer member profile missing');
expect(js.includes("firestore.getDoc(firestore.doc(db, 'servers', serverId, 'members', userId))"), 'member joined date lookup missing');
expect(js.includes('Dono') && js.includes('Administrador') && js.includes('Moderador') && js.includes('Membro'), 'role descriptions missing');
expect(css.includes('.v219-date-divider') && css.includes('.v219-member-group'), 'date/member hierarchy styles missing');
expect(css.includes('.v219-role-settings') && css.includes('.v219-role-row'), 'role management polish missing');
expect(css.includes('.v219-profile-card') && css.includes('.v219-profile-banner'), 'rich profile styles missing');
expect(css.includes('--banana-role-owner') && css.includes('.v219-color-control'), 'role color visual system missing');

console.log('Banana Cord V2.0.19+ detail polish regression checks: OK');
