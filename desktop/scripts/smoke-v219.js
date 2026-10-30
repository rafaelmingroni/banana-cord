const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const expect = (ok, message) => { if (!ok) throw new Error(message); };

const pkg = JSON.parse(read('package.json'));
const html = read('src/index.html');
const js = read('src/v219-details.js');
const css = read('src/v219-details.css');

expect(pkg.version === '2.0.19', `expected package version 2.0.19, got ${pkg.version}`);
expect(html.includes('v219-details.css') && html.includes('v219-details.js'), 'V2.0.19 detail assets are not loaded');
expect(js.includes('Hoje —') && js.includes('Ontem —'), 'today/yesterday labels missing');
expect(js.includes('1 semana atrás') && js.includes('fullDate'), 'older date context missing');
expect(js.includes("decorateMessageDates(list, '.message:not(.dm-message)')"), 'server message date dividers missing');
expect(js.includes("decorateMessageDates(list, '.dm-message')"), 'DM date dividers missing');
expect(js.includes("ROLE_GROUP") && js.includes("Administradores") && js.includes("Moderadores"), 'hierarchy groups missing');
expect(js.includes("state.socket.emit('member:set-role'"), 'role assignment action missing');
expect(js.includes('Dono') && js.includes('Administrador') && js.includes('Moderador') && js.includes('Membro'), 'role descriptions missing');
expect(css.includes('.v219-date-divider') && css.includes('.v219-member-group'), 'date/member hierarchy styles missing');
expect(css.includes('.v219-role-settings') && css.includes('.v219-role-row'), 'role management polish missing');

console.log('Banana Cord V2.0.19 detail polish regression checks: OK');
