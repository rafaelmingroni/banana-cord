const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read('src/index.html');
const css = read('src/mingrx-obsidian.css');
const socialCss = read('src/mingrx-obsidian-social.css');
const js = read('src/mingrx-obsidian.js');
const socialJs = read('src/mingrx-obsidian-social.js');

assert(html.includes('mingrx-obsidian.css'), 'Camada Obsidian principal não foi carregada.');
assert(html.includes('mingrx-obsidian-social.css'), 'Camada Obsidian social não foi carregada.');
assert(html.includes('mingrx-obsidian.js'), 'Runtime Obsidian principal não foi carregado.');
assert(html.includes('mingrx-obsidian-social.js'), 'Runtime Obsidian social não foi carregado.');
assert(html.indexOf('mingrx-obsidian.css') > html.indexOf('mingrx-31-ux-fixes.css'), 'Obsidian CSS deve carregar depois dos patches legados.');
assert(html.indexOf('mingrx-obsidian-social.js') > html.indexOf('mingrx-312-private-fix.js'), 'Obsidian social JS deve carregar por último.');

assert(css.includes('--mx-font-ui'), 'Design system Obsidian não define tipografia central.');
assert(css.includes('--mx-radius-xl'), 'Design system Obsidian não define escala de raios.');
assert(css.includes('--mx-focus-ring'), 'Design system Obsidian não define foco acessível.');
assert(css.includes('prefers-reduced-motion'), 'Obsidian não respeita reduzir movimento.');
assert(css.includes('.v214-private-sidebar .v1-dm-tools'), 'Privado não recebeu navegação Obsidian.');
assert(css.includes('.v214-private-home'), 'Landing de Privado não recebeu composição Obsidian.');
assert(css.includes('.mx-presence-dot'), 'Privado não comunica presença com o novo sistema.');

assert(socialCss.includes('grid-template-areas:"head head" "tabs body"'), 'Central social não usa a composição premium em duas áreas.');
assert(socialCss.includes('.mingrx-social-tab.active::before'), 'Navegação social não possui indicador ativo Mingrx.');
assert(socialCss.includes('.mingrx-social-row:hover .mingrx-social-actions'), 'Ações sociais não usam progressive disclosure.');
assert(socialCss.includes('.mingrx-add-friend') && socialCss.includes('border:0!important'), 'Adicionar amigo ainda está preso ao card-inside-card antigo.');
assert(socialCss.includes('.mingrx-social-status.online'), 'Central social não tem estados de presença refinados.');

assert(js.includes("document.getElementById('channels')") && js.includes("document.getElementById('emptyView')"), 'Observers Obsidian precisam ficar restritos às superfícies privadas.');
assert(!js.includes('observer.observe(document.body'), 'Obsidian não deve observar o DOM inteiro.');
assert(js.includes('--mx-private-sidebar:296px'), 'Obsidian deve preservar 296px em desktop amplo.');
assert(js.includes('--mx-private-sidebar:276px') && js.includes('max-width:1100px'), 'Obsidian deve preservar a largura intermediária de 276px.');
assert(js.includes('--mx-private-sidebar:256px') && js.includes('max-width:900px'), 'Obsidian deve preservar a largura compacta de 256px.');
assert(js.includes('--mx-private-sidebar:238px') && js.includes('max-width:760px'), 'Obsidian deve preservar a largura mínima de 238px.');
assert(js.includes('request.dataset.mxObsidianSignature !== requestSignature'), 'Pedidos privados precisam de decoração idempotente.');
assert(js.includes('friendHeading.dataset.mxObsidianSignature !== headingSignature'), 'Cabeçalho de amigos precisa de decoração idempotente.');
assert(js.includes('heading.textContent !== privateLabel') && js.includes('copy.textContent !== privateCopy'), 'Home privada não deve reescrever o DOM sem mudança real.');
assert(!js.includes("socket.emit") && !socialJs.includes("socket.emit"), 'Camada visual Obsidian não deve alterar eventos de rede.');
assert(socialJs.includes('mingrx-social-avatar-wrap'), 'Central social não injeta presença nos avatares.');
assert(socialJs.includes("[data-mx-dm]"), 'Ação de mensagem da central social não recebeu ícone consistente.');
assert(socialJs.includes("observer.observe(document.getElementById('modalBody')"), 'Observer social deve ficar restrito ao modal.');

console.log('Mingrx Obsidian social smoke: OK');
