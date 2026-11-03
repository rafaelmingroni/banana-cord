const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read('src/index.html');
const css = read('src/mingrx-polish.css');
const finalCss = read('src/mingrx-final-fixes.css');
const guardCss = read('src/mingrx-regression-guard.css');
const finalJs = read('src/mingrx-final-fixes.js');
const polish = read('src/mingrx-polish.js');
const socialCss = read('src/mingrx-social-polish.css');
const socialJs = read('src/mingrx-social-polish.js');
const markCss = read('src/mingrx-mark-polish.css');
const markJs = read('src/mingrx-mark-polish.js');
const svg = read('assets/mingrx.svg');
const pkg = JSON.parse(read('package.json'));

assert(html.includes('class="mingrx-ui"'), 'Body precisa nascer com a camada Mingrx ativa para evitar flash legado.');
assert(html.includes('mingrx-polish.css'), 'CSS de polish não foi carregado.');
assert(html.includes('mingrx-polish.js'), 'Runtime de polish não foi carregado.');
assert(html.includes('mingrx-social-polish.css'), 'CSS social Mingrx não foi carregado.');
assert(html.includes('mingrx-social-polish.js'), 'Runtime social Mingrx não foi carregado.');
assert(html.includes('mingrx-mark-polish.css'), 'CSS de marcas temáticas não foi carregado.');
assert(html.includes('mingrx-mark-polish.js'), 'Runtime de marcas temáticas não foi carregado.');
assert(html.includes('mingrx-final-fixes.css') && html.includes('mingrx-final-fixes.js'), 'Camada final de layout/interação não foi carregada.');
assert(html.includes('mingrx-regression-guard.css'), 'Guard final de regressão não foi carregado.');
assert(!html.includes('banana-cloud://firebase'), 'Rótulo técnico banana-cloud ainda aparece no HTML.');

assert(css.includes('#homeServer{display:none!important}'), 'Quadrado Home legado ainda pode aparecer no topo.');
assert(css.includes('.app.dm-mode') && css.includes('minmax(280px,296px)'), 'Sidebar privada não possui largura mínima segura.');
assert(css.includes('word-break:normal!important'), 'Texto da sidebar privada ainda pode quebrar letra por letra.');
assert(css.includes('.cloud-gate') && css.includes('var(--mx-accent)'), 'Autenticação não está usando tokens do tema Mingrx.');
assert(css.includes('.settings-shell') && css.includes('grid-template-columns:210px'), 'Settings não recebeu enquadramento Mingrx estável.');

assert(finalCss.includes('.messages') && finalCss.includes('max-width:none!important'), 'Painel de mensagens ainda pode ficar preso a largura fixa.');
assert(finalCss.includes('.composer') && finalCss.includes('width:100%!important'), 'Composer ainda não acompanha toda a largura do chat.');
assert(finalCss.includes('.mingrx-members-head') && finalCss.includes('.mingrx-members-close'), 'Drawer de membros não possui cabeçalho/fechamento premium.');
assert(finalJs.includes('pointerdown') && finalJs.includes("event.key === 'Escape'"), 'Drawer de membros não fecha por clique externo e ESC.');
assert(finalJs.includes("aria-expanded") && finalJs.includes("aria-hidden"), 'Drawer de membros não sincroniza acessibilidade.');

assert(guardCss.includes('grid-template-columns:296px minmax(0,1fr)!important'), 'Privado não está protegido como grid de duas colunas.');
assert(guardCss.includes('grid-column:2!important'), 'Conteúdo principal não está explicitamente preso à segunda coluna Mingrx.');
assert(guardCss.includes('grid-auto-columns:0!important'), 'Colunas implícitas legadas ainda podem reaparecer.');
assert(guardCss.includes('ghost') || guardCss.includes('implicit'), 'Guard não documenta a regressão de coluna implícita.');

assert(polish.includes("['Banana Cord', BRAND]"), 'Limpeza de marca Banana Cord ausente.');
assert(polish.includes("['banana-cloud://firebase', 'Mingrx Cloud']"), 'Limpeza do rótulo de conexão legado ausente.');
assert(polish.includes("['Your profile', 'Seu perfil']"), 'Correção de idioma de perfil ausente.');
assert(polish.includes("['Save profile', 'Salvar perfil']"), 'Correção de idioma do botão de perfil ausente.');
assert(polish.includes("['Servidor', 'Comunidade']"), 'Terminologia Servidor -> Comunidade não está protegida.');
assert(polish.includes("brand.onclick = () => document.getElementById('homeServer')?.click()"), 'Marca Mingrx não substitui funcionalmente o quadrado Home legado.');
assert(polish.includes('var(--mx-accent)'), 'Marca Mingrx não está ligada à cor do tema.');
assert(polish.includes('mingrx-x'), 'Wordmark Mingrx não trata o X como detalhe de identidade.');
assert(polish.includes('mingrx-settings-version'), 'Rodapé/versionamento Mingrx das configurações não foi injetado.');
assert(polish.includes("querySelectorAll(':scope > .settings-brand,:scope > .settings-nav-foot')"), 'Brand/versionamento legado das configurações ainda pode coexistir com Mingrx.');
assert(polish.includes("content.classList.add('settings-main')"), 'Conteúdo real das configurações não recebe a camada de layout Mingrx.');
assert(polish.includes('installNotificationBrandGuard') && polish.includes('MingrxNotification'), 'Notificações nativas ainda podem expor branding Banana Cord.');

assert(socialCss.includes('.mingrx-social-hub') && socialCss.includes('.mingrx-social-tabs'), 'Central social Mingrx não possui estrutura visual própria.');
assert(socialCss.includes('.mingrx-add-friend') && socialCss.includes('.mingrx-social-row'), 'Busca e cards sociais Mingrx estão incompletos.');
assert(socialJs.includes('window.MingrxOpenFriends'), 'Central social Mingrx não expõe abertura controlada.');
assert(socialJs.includes("friend:search") && socialJs.includes("friend:request"), 'Busca/solicitação de amizade não estão ligadas ao backend existente.');
assert(socialJs.includes('#v1FriendsBtn,.v214-private-request'), 'Gatilhos sociais legados não são redirecionados para a central Mingrx.');
assert(socialJs.includes('#v207AddFriendBtn,#v207StartFriend'), 'Adicionar amigo legado não é redirecionado para a central Mingrx.');
assert(socialJs.includes("friend:accept") && socialJs.includes("friend:reject") && socialJs.includes("friend:unblock"), 'Ações sociais essenciais não estão cobertas.');
assert(!socialJs.includes('new MutationObserver'), 'Central social não deve observar o DOM inteiro: isso pode criar loop de avatar e alto uso de CPU.');
assert(socialJs.includes("node.dataset.socialAvatarHydrated === 'true'"), 'Hidratação de avatar não possui proteção contra reaplicação.');
assert(socialJs.includes('bindSocialSocket(state?.socket)'), 'Central social não garante binding do socket ao abrir.');

for (const selector of ['big-banana-img','v214-private-home','mingrx-community-head','banana-updater-logo','cloud-home-logo']) {
  assert(markJs.includes(selector), `Marca fixa ainda não está coberta em ${selector}.`);
}
assert(markJs.includes('var(--mx-accent)'), 'Marcas de superfície ainda não acompanham o tema.');
assert(markCss.includes('mingrx-private-mark') && markCss.includes('mingrx-updater-mark'), 'Dimensionamento das marcas temáticas está incompleto.');
assert(svg.includes('#7c5cff') && !svg.includes('mxFold') && !svg.includes('linearGradient'), 'SVG oficial ainda possui brilho/fold assimétrico.');
assert(pkg.scripts['smoke:e2e-v2'].includes('e2e-mingrx-layout.js'), 'E2E de layout responsivo não está na suíte principal.');
assert(pkg.scripts['smoke:e2e-v2'].includes('e2e-mingrx-social.js'), 'E2E da central social Mingrx não está na suíte principal.');

console.log('Mingrx UI polish smoke: OK');
