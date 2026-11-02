const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read('src/index.html');
const css = read('src/mingrx-rebrand.css');
const shell = read('src/mingrx-shell.js');
const svg = read('assets/mingrx.svg');
const pkg = JSON.parse(read('package.json'));
const tray = read('tray.js');

assert(html.includes('<title>Mingrx</title>'), 'Título do renderer não está com a marca Mingrx.');
assert(html.includes('mingrx-rebrand.css'), 'Camada visual Mingrx não foi carregada.');
assert(html.includes('mingrx-shell.js'), 'Shell Mingrx não foi carregado.');
assert(html.includes('../assets/mingrx.svg'), 'Logo Mingrx não está no renderer inicial.');
assert(!html.includes('>Banana Cord<'), 'Ainda existe Banana Cord visível no HTML principal.');

assert(css.includes('grid-template-rows:56px'), 'Novo shell horizontal não foi encontrado.');
assert(css.includes('mingrx-members-open'), 'Drawer contextual de membros não foi encontrado.');
assert(!/box-shadow:\s*0\s+0\s+[0-9]+px\s+#[0-9a-f]{3,8}/i.test(css), 'A camada Mingrx não deve depender de glow neon.');
assert(shell.includes("BRAND = 'Mingrx'"), 'Shell não declara a marca Mingrx.');
assert(shell.includes('MutationObserver'), 'Shell deve proteger modais legados contra textos Banana Cord.');

assert(svg.includes('viewBox="0 0 1024 1024"'), 'SVG oficial Mingrx precisa ser 1024x1024.');
assert(svg.includes('#7c5cff'), 'Cor principal Mingrx ausente do SVG.');

assert(pkg.build.productName === 'Mingrx Preview', 'Preview deve instalar separado como Mingrx Preview.');
assert(pkg.build.appId === 'com.mingrx.preview', 'Preview precisa de appId isolado.');
assert(pkg.build.win.icon === 'assets/mingrx.ico', 'Build ainda não aponta para o ícone Mingrx.');
assert(pkg.scripts['smoke:mingrx'], 'Script smoke:mingrx não foi registrado.');
assert(tray.includes('Abrir Mingrx'), 'Tray ainda não foi rebatizado para Mingrx.');
assert(tray.includes("assets', 'mingrx-tray.png"), 'Tray não usa o ícone Mingrx.');

console.log('Mingrx rebrand smoke: OK');
