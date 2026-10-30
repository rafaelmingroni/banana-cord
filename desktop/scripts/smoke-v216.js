const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (cond, message) => { if (!cond) throw new Error(message); };

const main = read('e2ee-main.js');
const cloud = read('src/cloud-v2-v216-e2ee.js');
const client = read('src/v216-e2ee-client.js');
const ui = read('src/v216-e2ee-ui.js');
const index = read('src/index.html');
const buildCloud = read('scripts/build-cloud-browser.js');
const rules = fs.readFileSync(path.resolve(root, '..', 'firebase', 'firestore.rules'), 'utf8');

must(main.includes("generateKeyPairSync('x25519')"), 'X25519 key generation missing');
must(main.includes("createCipheriv('aes-256-gcm'"), 'AES-256-GCM encryption missing');
must(main.includes('safeStorage.encryptString'), 'private key is not protected by safeStorage');
must(main.includes('safeStorage.decryptString'), 'private key cannot be restored securely');
must(!main.includes('privateKey: public'), 'suspicious private key export');

must(cloud.includes("'e2eeKeys'"), 'E2EE public-key registry not used');
must(cloud.includes('window.BananaE2EE.encrypt'), 'DM send does not encrypt before Firestore');
must(cloud.includes('window.BananaE2EE.decrypt'), 'DM receive does not decrypt locally');
must(cloud.includes("lastMessage: { fromId: this.user.uid, toId: peerId, at, e2ee: true }"), 'encrypted DM preview leaks or is missing');
must(!/batch\.set\(messageRef,[\s\S]{0,500}\btext\s*,/.test(cloud), 'new encrypted DM writes plaintext text field');

must(client.includes("ipcRenderer.invoke('e2ee:encrypt'"), 'minimal E2EE renderer bridge missing');
must(ui.includes('Criptografia ponta a ponta ativa'), 'E2EE UI indicator missing');
must(index.indexOf('v216-e2ee-client.js') < index.indexOf('cloud-browser/cloud-v2-all.browser.js'), 'E2EE bridge must load before cloud bundle');
must(index.includes('v216-e2ee-ui.js'), 'V2.0.16 E2EE UI patch not loaded');
must(buildCloud.includes("require('./cloud-v2-v216-e2ee.js');"), 'V2.0.16 cloud patch not bundled');

must(rules.includes('match /e2eeKeys/{uid}'), 'E2EE key registry rules missing');
must(rules.includes("value.algorithm == 'X25519-AES-256-GCM'"), 'encrypted DM envelope rules missing');
must(rules.includes("!('text' in request.resource.data)"), 'encrypted DM downgrade protection missing');

console.log('Banana Cord V2.0.16 E2EE regression checks: OK');
