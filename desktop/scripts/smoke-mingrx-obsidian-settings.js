const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const html = read('src/index.html');
const css = read('src/mingrx-obsidian-settings.css');
const js = read('src/mingrx-obsidian-settings.js');

assert(html.includes('mingrx-obsidian-settings.css'), 'Settings Obsidian CSS não foi carregado.');
assert(html.includes('mingrx-obsidian-settings.js'), 'Settings Obsidian JS não foi carregado.');
assert(html.indexOf('mingrx-obsidian-settings.css') > html.indexOf('mingrx-obsidian-social.css'), 'Settings CSS deve carregar depois da camada social.');
assert(html.indexOf('mingrx-obsidian-settings.js') > html.indexOf('mingrx-obsidian-social.js'), 'Settings JS deve carregar por último.');
assert(css.includes('.modal-card.settings-modal'), 'Modal de configurações não recebeu shell Obsidian.');
assert(css.includes('.mx-settings-search'), 'Settings não possui busca visual.');
assert(css.includes('.settings-nav-item.active::before'), 'Navegação de Settings não possui indicador ativo Mingrx.');
assert(css.includes('#settingsArea .settings-card'), 'Cards legados de Settings não foram normalizados.');
assert(css.includes('#settingsArea .v21-setting-card'), 'Settings sociais não foram normalizados.');
assert(css.includes('prefers-reduced-motion'), 'Settings Obsidian não respeita reduzir movimento.');
assert(js.includes('new MutationObserver(queueDecorate)'), 'Settings precisa observar apenas renderizações do modal.');
assert(js.includes("document.getElementById('modalBody')"), 'Observer de Settings deve ficar restrito ao modalBody.');
assert(!js.includes('observe(document.body'), 'Settings não deve observar o DOM inteiro.');
assert(js.includes('Buscar configurações'), 'Settings não implementou busca.');
assert(js.includes("replaceAll('Banana Cord', 'Mingrx')"), 'Settings ainda pode exibir marca legada.');
assert(js.includes('tabProfile') && js.includes('tabAudio') && js.includes('tabVideo') && js.includes('tabGeneral') && js.includes('tabDiag') && js.includes('tabUpdates'), 'Ícones vetoriais não cobrem as abas principais.');
assert(js.includes('tabV21Social'), 'A aba social não recebeu ícone Obsidian.');
assert(js.includes("event.key.toLowerCase() === 'f'"), 'Settings não oferece atalho de busca Ctrl/Cmd+F.');
console.log('Mingrx Obsidian settings smoke: OK');
