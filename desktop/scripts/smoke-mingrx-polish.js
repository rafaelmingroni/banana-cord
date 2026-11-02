const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read('src/index.html');
const css = read('src/mingrx-polish.css');
const polish = read('src/mingrx-polish.js');
const markCss = read('src/mingrx-mark-polish.css');
const markJs = read('src/mingrx-mark-polish.js');

assert(html.includes('class="mingrx-ui"'), 'Body precisa nascer com a camada Mingrx ativa para evitar flash legado.');
assert(html.includes('mingrx-polish.css'), 'CSS de polish não foi carregado.');
assert(html.includes('mingrx-polish.js'), 'Runtime de polish não foi carregado.');
assert(html.includes('mingrx-mark-polish.css'), 'CSS de marcas temáticas não foi carregado.');
assert(html.includes('mingrx-mark-polish.js'), 'Runtime de marcas temáticas não foi carregado.');
assert(!html.includes('banana-cloud://firebase'), 'Rótulo técnico banana-cloud ainda aparece no HTML.');

assert(css.includes('#homeServer{display:none!important}'), 'Quadrado Home legado ainda pode aparecer no topo.');
assert(css.includes('.app.dm-mode') && css.includes('minmax(280px,296px)'), 'Sidebar privada não possui largura mínima segura.');
assert(css.includes('word-break:normal!important'), 'Texto da sidebar privada ainda pode quebrar letra por letra.');
assert(css.includes('.cloud-gate') && css.includes('var(--mx-accent)'), 'Autenticação não está usando tokens do tema Mingrx.');
assert(css.includes('.settings-shell') && css.includes('grid-template-columns:210px'), 'Settings não recebeu enquadramento Mingrx estável.');

assert(polish.includes("['Banana Cord', BRAND]"), 'Limpeza de marca Banana Cord ausente.');
assert(polish.includes("['banana-cloud://firebase', 'Mingrx Cloud']"), 'Limpeza do rótulo de conexão legado ausente.');
assert(polish.includes("['Your profile', 'Seu perfil']"), 'Correção de idioma de perfil ausente.');
assert(polish.includes("['Save profile', 'Salvar perfil']"), 'Correção de idioma do botão de perfil ausente.');
assert(polish.includes("['Servidor', 'Comunidade']"), 'Terminologia Servidor -> Comunidade não está protegida.');
assert(polish.includes("brand.onclick = () => document.getElementById('homeServer')?.click()"), 'Marca Mingrx não substitui funcionalmente o quadrado Home legado.');
assert(polish.includes('var(--mx-accent)'), 'Marca Mingrx não está ligada à cor do tema.');
assert(polish.includes('mingrx-x'), 'Wordmark Mingrx não trata o X como detalhe de identidade.');
assert(polish.includes('mingrx-settings-version'), 'Rodapé/versionamento Mingrx das configurações não foi injetado.');

for (const selector of ['big-banana-img','v214-private-home','mingrx-community-head','banana-updater-logo','cloud-home-logo']) {
  assert(markJs.includes(selector), `Marca fixa ainda não está coberta em ${selector}.`);
}
assert(markJs.includes('var(--mx-accent)'), 'Marcas de superfície ainda não acompanham o tema.');
assert(markCss.includes('mingrx-private-mark') && markCss.includes('mingrx-updater-mark'), 'Dimensionamento das marcas temáticas está incompleto.');

console.log('Mingrx UI polish smoke: OK');
