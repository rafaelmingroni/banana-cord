const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read('src/index.html');
const css = read('src/mingrx-rebrand.css');
const shell = read('src/mingrx-shell.js');
const themesCss = read('src/mingrx-themes.css');
const themeA11yCss = read('src/mingrx-theme-a11y.css');
const themesJs = read('src/mingrx-themes.js');
const themeBootstrap = read('src/mingrx-theme-bootstrap.js');
const svg = read('assets/mingrx.svg');
const pkg = JSON.parse(read('package.json'));
const tray = read('tray.js');
const main = read('main-v120.js');
const installer = read('build/installer.nsh');

assert(html.includes('<title>Mingrx</title>'), 'Título do renderer não está com a marca Mingrx.');
assert(html.includes('mingrx-rebrand.css'), 'Camada visual Mingrx não foi carregada.');
assert(html.includes('mingrx-shell.js'), 'Shell Mingrx não foi carregado.');
assert(html.includes('mingrx-theme-bootstrap.js'), 'Bootstrap de tema não está carregado antes do paint.');
assert(html.includes('mingrx-themes.css'), 'Sistema de temas não está carregado.');
assert(html.includes('mingrx-theme-a11y.css'), 'Foreground acessível dos temas não está carregado.');
assert(html.includes('mingrx-themes.js'), 'Seletor de temas não está carregado.');
assert(html.includes('../assets/mingrx.svg'), 'Logo Mingrx não está no renderer inicial.');
assert(!html.includes('>Banana Cord<'), 'Ainda existe Banana Cord visível no HTML principal.');

assert(css.includes('grid-template-rows:56px'), 'Novo shell horizontal não foi encontrado.');
assert(css.includes('mingrx-members-open'), 'Drawer contextual de membros não foi encontrado.');
assert(!/box-shadow:\s*0\s+0\s+[0-9]+px\s+#[0-9a-f]{3,8}/i.test(css), 'A camada Mingrx não deve depender de glow neon.');
assert(shell.includes("BRAND = 'Mingrx'"), 'Shell não declara a marca Mingrx.');
assert(shell.includes('MutationObserver'), 'Shell deve proteger modais legados contra textos Banana Cord.');
assert(shell.includes('openCommunityModal'), 'Entrada de comunidades não foi migrada para o shell Mingrx.');
assert(shell.includes('#addServerBtn,#v207StartServer'), 'Shell Mingrx não intercepta todos os gatilhos legados de comunidade.');
assert(shell.includes('replaceLegacyMarks'), 'Shell Mingrx não remove marcas visuais antigas do onboarding.');
assert(shell.includes('.banana-updater-logo img'), 'Updater ainda pode expor uma marca visual antiga.');

assert(themeBootstrap.includes("'system'"), 'Tema Sistema não é inicializado antes do primeiro paint.');
assert(themeBootstrap.includes('prefers-color-scheme: light'), 'Tema Sistema não acompanha o esquema do Windows.');
assert(themesJs.includes('tabMingrxAppearance'), 'Configurações não possuem aba Aparência.');
assert(themesJs.includes('localStorage.setItem(KEY'), 'Tema escolhido não é persistido localmente.');
for (const theme of ['system','midnight','pearl','crimson','ocean','forest','mono']) {
  assert(themesJs.includes(`id:'${theme}'`), `Tema ${theme} não está registrado no seletor.`);
}

function blockFor(source, theme) {
  const marker = `html[data-mingrx-theme="${theme}"]`;
  const start = source.indexOf(marker);
  assert(start >= 0, `Bloco CSS do tema ${theme} não encontrado.`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  assert(open >= 0 && close > open, `Bloco CSS inválido para ${theme}.`);
  return source.slice(open + 1, close);
}
function hexVar(block, name) {
  const match = block.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6})`));
  assert(match, `Token --${name} ausente.`);
  return match[1];
}
function luminance(hex) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

for (const theme of ['midnight','pearl','crimson','ocean','forest','mono']) {
  const block = blockFor(themesCss, theme);
  const a11y = blockFor(themeA11yCss, theme);
  const bg = hexVar(block, 'mx-bg');
  const panel = hexVar(block, 'mx-panel');
  const text = hexVar(block, 'mx-text');
  const text2 = hexVar(block, 'mx-text-2');
  const muted = hexVar(block, 'mx-muted');
  const accent = hexVar(block, 'mx-accent');
  const onAccent = hexVar(a11y, 'mx-on-accent');
  for (const [label, foreground, background] of [
    ['texto principal', text, bg],
    ['texto secundário', text2, panel],
    ['texto discreto', muted, bg],
    ['texto de ação', onAccent, accent]
  ]) {
    const ratio = contrast(foreground, background);
    assert(ratio >= 4.5, `${theme}: ${label} ficou com contraste ${ratio.toFixed(2)}:1 (< 4.5:1).`);
  }
}

assert(svg.includes('viewBox="0 0 1024 1024"'), 'SVG oficial Mingrx precisa ser 1024x1024.');
assert(svg.includes('#7c5cff'), 'Cor principal Mingrx ausente do SVG.');

assert(pkg.version === '3.0.0', `Release pública precisa ser Mingrx 3.0.0, recebeu ${pkg.version}.`);
assert(pkg.name === 'mingrx', 'Nome do pacote público deve ser mingrx.');
assert(pkg.build.productName === 'Mingrx', 'Produto público deve instalar como Mingrx.');
assert(!pkg.build.productName.includes('Preview'), 'Build pública não pode ser identificada como Preview.');
assert(pkg.build.appId === 'com.bananacord.app', 'App ID estável precisa ser preservado para atualizar instalações antigas no lugar.');
assert(pkg.build.artifactName.startsWith('Mingrx-Setup-'), 'Artefato oficial não está nomeado Mingrx.');
assert(pkg.build.protocols?.[0]?.schemes?.includes('mingrx'), 'Protocolo mingrx:// não está registrado.');
assert(pkg.build.protocols?.[0]?.schemes?.includes('bananacord'), 'Compatibilidade temporária bananacord:// foi removida cedo demais.');
assert(pkg.build.win.icon === 'assets/mingrx.ico', 'Build ainda não aponta para o ícone Mingrx.');
assert(pkg.build.nsis?.shortcutName === 'Mingrx', 'Atalho do Windows não está nomeado Mingrx.');
assert(pkg.build.nsis?.include === 'build/installer.nsh', 'Script NSIS de migração não está incluído no build.');
assert(installer.includes('Delete "$DESKTOP\\Banana Cord.lnk"'), 'Instalador não remove o atalho antigo da Área de Trabalho.');
assert(installer.includes('Delete "$SMPROGRAMS\\Banana Cord.lnk"'), 'Instalador não remove o atalho antigo do Menu Iniciar.');
assert(pkg.scripts['smoke:mingrx'], 'Script smoke:mingrx não foi registrado.');
assert(tray.includes('Abrir Mingrx'), 'Tray ainda não foi rebatizado para Mingrx.');
assert(tray.includes("assets', 'mingrx-tray.png"), 'Tray não usa o ícone Mingrx.');
assert(tray.includes("app.setAppUserModelId('com.bananacord.app')"), 'Tray perdeu a identidade de atualização in-place.');
assert(main.includes("path.join(app.getPath('appData'), 'Banana Cord')"), 'Migração do userData legado não está protegida.');
assert(main.includes("app.setPath('userData', legacy)"), 'Dados locais antigos não são reutilizados no upgrade 3.0.');
assert(main.includes("app.setName('Mingrx')"), 'Processo principal não assume o nome Mingrx.');

console.log('Mingrx 3.0 rebrand + migration smoke: OK');