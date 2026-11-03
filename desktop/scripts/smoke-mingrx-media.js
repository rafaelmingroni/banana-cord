const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

const html = read('src/index.html');
const media = read('src/mingrx-media.js');
const invite = read('src/mingrx-invite-fix.js');
const inviteCss = read('src/mingrx-invite-fix.css');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(repo, 'firebase', 'firebase.json'), 'utf8'));

for (const asset of ['mingrx-media.css','mingrx-invite-fix.css','mingrx-media.js','mingrx-invite-fix.js']) {
  assert(html.includes(asset), `${asset} não está carregado no index.`);
}
assert(html.indexOf('mingrx-media.js') > html.indexOf('mingrx-regression-guard.js'), 'Mídia Mingrx precisa carregar depois das camadas legadas.');
assert(html.indexOf('mingrx-invite-fix.js') > html.indexOf('mingrx-media.js'), 'Invite fix precisa ser a última camada funcional.');

assert(!media.includes("require('firebase/storage')"), 'Mingrx Spark não pode importar Firebase Storage.');
assert(!media.includes('getStorage('), 'Mingrx Spark não pode inicializar Firebase Storage.');
assert(!media.includes('uploadBytes'), 'Mingrx Spark não pode tentar upload para Firebase Storage.');
assert(!media.includes('getDownloadURL'), 'Mingrx Spark não pode depender de download URL do Storage.');
assert(!media.includes('mingrxAttachBtn'), 'Botão de anexo em chat/DM precisa permanecer removido no Spark.');
assert(!media.includes("addEventListener('paste'"), 'Paste de screenshot não deve iniciar upload no Spark.');
assert(media.includes('chatImageUpload: false'), 'Runtime não declara anexos de chat desativados.');
assert(media.includes('sparkMode: true'), 'Runtime não declara modo Spark.');
assert(media.includes('[[MINGRX_IMAGE_V1:'), 'Compatibilidade de leitura com marcador 3.0 foi removida.');
assert(media.includes('parseMedia'), 'Compatibilidade de renderização de imagens antigas foi removida.');
assert(media.includes('blobToDataUrl'), 'Foto da comunidade não usa armazenamento gratuito no próprio documento.');
assert(media.includes("state.socket.emit('server:update'"), 'Foto da comunidade não persiste pela camada existente.');
assert(media.includes('mingrx-community-photo-card'), 'Controle gratuito de foto da comunidade foi removido.');
assert(media.includes('modo gratuito (Spark)'), 'UI não explica que a foto da comunidade usa o modo gratuito.');

assert(invite.includes('cloneNode(true)') && invite.includes('old.replaceWith(fresh)'), 'Invite ainda pode herdar listeners legados que congelam a UI.');
assert(invite.includes('openModal(`') && invite.indexOf('openModal(`') < invite.indexOf("emitWithAck('invite:create-temporary'"), 'Modal de convite não abre antes das operações assíncronas.');
assert(invite.includes('setTimeout(() =>') && invite.includes('6500'), 'Invite temporário não possui timeout anti-freeze.');
assert(invite.includes('mingrx://join/'), 'Novo link de convite Mingrx ausente.');
assert(inviteCss.includes('.mingrx-invite') && inviteCss.includes('.mingrx-temp-card'), 'Modal Mingrx de convite não está estilizado.');

assert(!firebaseJson.storage, 'firebase.json ainda declara Firebase Storage, incompatível com a estratégia Spark da 3.1.');
assert(!firebaseJson.emulators?.storage, 'Emulador de Storage ainda está configurado na 3.1.');
assert(!fs.existsSync(path.join(repo, 'firebase', 'storage.rules')), 'storage.rules não deve fazer parte da configuração Spark atual.');

console.log('Mingrx Spark media + invite static regression smoke: OK');
