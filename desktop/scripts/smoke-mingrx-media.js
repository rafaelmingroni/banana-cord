const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

const html = read('src/index.html');
const media = read('src/mingrx-media.js');
const ux31 = read('src/mingrx-31-ux-fixes.js');
const v1 = read('src/v1.js');
const invite = read('src/mingrx-invite-fix.js');
const inviteCss = read('src/mingrx-invite-fix.css');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(repo, 'firebase', 'firebase.json'), 'utf8'));

for (const asset of ['mingrx-media.css','mingrx-invite-fix.css','mingrx-media.js','mingrx-invite-fix.js','mingrx-31-ux-fixes.js','mingrx-31-ux-fixes.css']) {
  assert(html.includes(asset), `${asset} não está carregado no index.`);
}
assert(html.indexOf('mingrx-media.js') > html.indexOf('mingrx-regression-guard.js'), 'Mídia Mingrx precisa carregar depois das camadas legadas.');
assert(html.indexOf('mingrx-31-ux-fixes.js') > html.indexOf('mingrx-media.js'), 'Correções 3.1 precisam carregar depois da mídia Spark.');
assert(html.indexOf('mingrx-invite-fix.js') > html.indexOf('mingrx-media.js'), 'Invite fix precisa carregar depois da mídia.');

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
assert(media.includes('updateCommunityPhoto'), 'Fluxo único de atualização da foto da comunidade ausente.');
assert(media.includes('clearCommunityPhoto'), 'Fluxo único de remoção da foto da comunidade ausente.');
assert(media.includes('INPUT_MAX = 12 * 1024 * 1024'), 'Foto da comunidade voltou a exigir arquivo original muito pequeno.');
assert(media.includes('mingrx-community-photo-card'), 'Controle gratuito de foto da comunidade foi removido.');
assert(media.includes('modo gratuito (Spark)'), 'UI não explica que a foto da comunidade usa o modo gratuito.');

// The mature V1 renderer owns drag/drop, unread/mention badges and the context menu.
// Mingrx 3.1 must wrap/decorate it, never replace it with a simpler button renderer.
assert(v1.includes('b.draggable = true'), 'Renderer legado não contém reordenação de servidores esperada.');
assert(v1.includes('b.oncontextmenu'), 'Renderer legado não contém menu de contexto esperado.');
assert(v1.includes('v1-server-mention') && v1.includes('v1-server-unread'), 'Renderer legado não contém badges de servidor esperados.');
assert(ux31.includes('const baseRenderServers = renderServers'), 'Mingrx 3.1 não preserva o renderer maduro de servidores.');
assert(ux31.includes('baseRenderServers.apply(this, args)'), 'Mingrx 3.1 substituiu o renderer de servidores em vez de decorá-lo.');
assert(ux31.includes('renderServerButtonsWithPhotos'), 'Decorador de fotos da barra de servidores ausente.');
assert(ux31.includes('mingrx-community-button-has-photo'), 'Estado visual de foto do servidor ausente.');
assert(ux31.includes("closest('.server-icon[data-server-id]')"), 'Mingrx 3.1 não identifica o servidor do menu de contexto.');
assert(ux31.includes("closest('.v1-menu-item')"), 'Mingrx 3.1 não intercepta o menu legado de foto.');
assert(ux31.includes('updateCommunityPhoto(file, server)'), 'Menu Trocar foto ainda não usa o compressor Spark unificado.');
assert(ux31.includes('clearCommunityPhoto(server)'), 'Menu Remover foto ainda não usa o fluxo Spark unificado.');
assert(!ux31.includes('file.size > 550000'), 'Limite legado de 550 KB reapareceu na correção 3.1.');

assert(invite.includes('cloneNode(true)') && invite.includes('old.replaceWith(fresh)'), 'Invite ainda pode herdar listeners legados que congelam a UI.');
assert(invite.includes('openModal(`') && invite.indexOf('openModal(`') < invite.indexOf("emitWithAck('invite:create-temporary'"), 'Modal de convite não abre antes das operações assíncronas.');
assert(invite.includes('setTimeout(() =>') && invite.includes('6500'), 'Invite temporário não possui timeout anti-freeze.');
assert(invite.includes('mingrx://join/'), 'Novo link de convite Mingrx ausente.');
assert(inviteCss.includes('.mingrx-invite') && inviteCss.includes('.mingrx-temp-card'), 'Modal Mingrx de convite não está estilizado.');

assert(!firebaseJson.storage, 'firebase.json ainda declara Firebase Storage, incompatível com a estratégia Spark da 3.1.');
assert(!firebaseJson.emulators?.storage, 'Emulador de Storage ainda está configurado na 3.1.');
assert(!fs.existsSync(path.join(repo, 'firebase', 'storage.rules')), 'storage.rules não deve fazer parte da configuração Spark atual.');

console.log('Mingrx Spark media + server photo + invite static regression smoke: OK');
