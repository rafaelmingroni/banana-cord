const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const cloud = fs.readFileSync(path.join(root, 'src', 'cloud-v2-v212.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src', 'v212-ux-private-call.js'), 'utf8');
const voiceGuard = fs.readFileSync(path.join(root, 'src', 'v212-voice-access-guard.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'v212.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'scripts', 'build-cloud-browser.js'), 'utf8');
const rules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'database.rules.json'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

new Function(cloud);
new Function(ui);
new Function(voiceGuard);

assert(builder.includes("require('./cloud-v2-v212.js')"), 'V2.0.12 Cloud patch must stay inside the single Firebase bundle.');
assert(cloud.includes("require('firebase/firestore')"), 'V2.0.12 channel hierarchy must use the bundled Firestore runtime.');
assert(cloud.includes("require('firebase/database')"), 'V2.0.12 private calls must use the bundled Realtime Database runtime.');
assert(cloud.includes('normalizeAllowedRoles'), 'V2.0.12 must normalize channel permissions as a minimum-role hierarchy.');
assert(cloud.includes("event === 'private-call:start'"), 'Private call start event must exist.');
assert(cloud.includes("event === 'private-call:join'"), 'Private call join event must exist.');
assert(cloud.includes('privateVoiceRooms'), 'Private calls must use isolated private voice rooms.');
assert(cloud.includes('privateCallInvites'), 'Private calls must use explicit call invitations.');

assert(index.includes('v212.css'), 'V2.0.12 stylesheet must load.');
assert(index.includes('v212-ux-private-call.js'), 'V2.0.12 UX layer must load.');
assert(index.includes('v212-voice-access-guard.js'), 'Final V2.0.12 voice access guard must load last.');
assert(ui.includes('v212-message-link'), 'Message URLs must be linkified.');
assert(ui.includes("addEventListener('dblclick'"), 'Voice channels must support double-click join.');
assert(ui.includes("state.viewMode === 'dm'"), 'DM shell stability guard must remain active.');
assert(ui.includes('Cargo mínimo para acessar'), 'Channel permissions must explain minimum-role hierarchy.');
assert(ui.includes('v212PrivateCallBtn'), 'DM header must expose the private call button.');
assert(ui.includes('beginPrivateVoice'), 'Private call UI must join the shared WebRTC engine.');
assert(voiceGuard.includes('joinVoiceV212Guard'), 'Every voice join path must enforce the role hierarchy before WebRTC starts.');
assert(voiceGuard.includes('Você saiu da call porque seu cargo não permite mais acessar esse canal.'), 'Active calls must be closed after losing channel permission.');
assert(css.includes('.v212-call-card'), 'Private call card styling must exist.');

const parsedRules = JSON.parse(rules);
assert(parsedRules.rules.privateCallInvites, 'Realtime rules must protect private call invitations.');
assert(parsedRules.rules.privateVoiceRooms, 'Realtime rules must protect private voice rooms.');
assert(parsedRules.rules.privateVoiceRooms.$roomId.sessions.$sessionId, 'Each private voice session must have its own ownership rule.');

const [major, minor, patch] = String(pkg.version || '').split('.').map(Number);
assert(major === 2 && (minor > 0 || patch >= 12), 'V2.0.12 regression must run on version 2.0.12 or newer.');

console.log(`Banana Cord ${pkg.version} V2.0.12 UX/private-call regression checks: OK`);
