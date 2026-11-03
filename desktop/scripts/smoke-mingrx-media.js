const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

const html = read('src/index.html');
const media = read('src/mingrx-media.js');
const mediaCss = read('src/mingrx-media.css');
const invite = read('src/mingrx-invite-fix.js');
const inviteCss = read('src/mingrx-invite-fix.css');
const storageBridge = read('src/cloud-v2-storage.js');
const cloudBrand = read('src/cloud-v2-brand.js');
const build = read('scripts/build-cloud-browser.js');
const updater = read('src/v217-premium-updater.js');
const storageRules = fs.readFileSync(path.join(repo, 'firebase', 'storage.rules'), 'utf8');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(repo, 'firebase', 'firebase.json'), 'utf8'));

for (const asset of ['mingrx-media.css','mingrx-invite-fix.css','mingrx-media.js','mingrx-invite-fix.js']) {
  assert(html.includes(asset), `${asset} não está carregado no index.`);
}
assert(html.indexOf('mingrx-media.js') > html.indexOf('mingrx-regression-guard.js'), 'Mídia Mingrx precisa carregar depois das camadas legadas.');
assert(html.indexOf('mingrx-invite-fix.js') > html.indexOf('mingrx-media.js'), 'Invite fix precisa ser a última camada funcional.');

assert(build.includes("require('./cloud-v2-storage.js');"), 'Bridge de Storage não está no mesmo bundle Firebase do Cloud.');
assert(build.indexOf("require('./cloud-v2.js');") < build.indexOf("require('./cloud-v2-storage.js');"), 'Storage precisa carregar depois da inicialização Firebase.');
assert(storageBridge.includes("getApps()[0]"), 'Bridge não reutiliza o app Firebase já inicializado.');
assert(storageBridge.includes('getStorage(firebaseApp())'), 'Storage não está associado explicitamente ao app Cloud inicializado.');
assert(storageBridge.includes('window.MingrxCloudStorage'), 'API segura de Storage não foi exposta ao renderer.');
assert(!media.includes("require('firebase/storage')"), 'Mídia voltou a carregar uma segunda instância isolada do Firebase Storage.');
assert(media.includes('window.MingrxCloudStorage?.uploadImage'), 'Mídia não usa o bridge compartilhado do Cloud.');
assert(media.includes('40 * 1024 * 1024'), 'Fotos grandes não possuem limite de entrada realista antes da compactação.');
assert(media.includes('width * 0.78') && media.includes('height * 0.78'), 'Compressor não reduz dimensões progressivamente.');
assert(media.includes('[[MINGRX_IMAGE_V1:'), 'Marcador de imagem versionado ausente.');
assert(media.includes("'dm:send'") && media.includes("'message:send'"), 'Imagem não atende DM e comunidade.');
assert(media.includes("addEventListener('paste'"), 'Colar screenshot do clipboard não está suportado.');
assert(media.includes('mingrx/community-icons/'), 'Foto da comunidade não usa caminho próprio.');
assert(media.includes("icon.includes('🖼')"), 'Menu legado de foto ainda pode cair no limite antigo de 550 KB.');
assert(media.includes('pickCommunityPhoto'), 'Fluxo unificado de foto da comunidade ausente.');
assert(mediaCss.includes('#mingrxAttachBtn') && mediaCss.includes('.mingrx-chat-image-card'), 'UI de anexos não está estilizada.');

assert(cloudBrand.includes('Mingrx Cloud') && cloudBrand.includes('Conta Mingrx'), 'Auth Cloud ainda pode nascer com marca antiga.');
assert(updater.includes('MINGRX UPDATE') && updater.includes('Temos um novo nome: Mingrx'), 'Updater não comunica corretamente a migração para Mingrx.');

assert(invite.includes('cloneNode(true)') && invite.includes('old.replaceWith(fresh)'), 'Invite ainda pode herdar listeners legados que congelam a UI.');
assert(invite.includes('openModal(`') && invite.indexOf('openModal(`') < invite.indexOf("emitWithAck('invite:create-temporary'"), 'Modal de convite não abre antes das operações assíncronas.');
assert(invite.includes('setTimeout(() =>') && invite.includes('6500'), 'Invite temporário não possui timeout anti-freeze.');
assert(invite.includes('mingrx://join/'), 'Novo link de convite Mingrx ausente.');
assert(inviteCss.includes('.mingrx-invite') && inviteCss.includes('.mingrx-temp-card'), 'Modal Mingrx de convite não está estilizado.');

assert(firebaseJson.storage?.rules === 'storage.rules', 'firebase.json não aponta para storage.rules.');
assert(storageRules.includes('/mingrx/community-icons/{uid}/') && storageRules.includes('/mingrx/chat-media/{uid}/'), 'Storage rules não cobrem os dois tipos de imagem.');
assert(storageRules.includes('request.auth.uid == uid'), 'Storage uploads não estão limitados ao próprio usuário.');
assert(storageRules.includes('request.auth.token.email_verified == true'), 'Storage não exige e-mail verificado.');
assert(storageRules.includes("image/(png|jpeg|webp)"), 'Storage não valida MIME de imagem.');

console.log('Mingrx media + Firebase instance + invite regression smoke: OK');
