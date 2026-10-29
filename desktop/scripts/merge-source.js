const fs = require('fs');
const path = require('path');

const desktopDir = path.join(__dirname, '..');

function numericPart(name) {
  const m = name.match(/\.part(\d+)$/);
  return m ? Number(m[1]) : 999999;
}

function mergeIfNeeded(dir, baseName) {
  const target = path.join(dir, baseName);
  // Desde a v1, o arquivo-fonte completo é a referência. Os .part ficam apenas
  // como compatibilidade/fallback para clones antigos do projeto.
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    console.log(`Usando ${baseName} completo.`);
    return;
  }
  const prefix = `${baseName}.part`;
  const parts = fs.readdirSync(dir)
    .filter(name => name.startsWith(prefix))
    .sort((a, b) => numericPart(a) - numericPart(b));
  if (!parts.length) throw new Error(`Nenhuma fonte encontrada para ${baseName}`);
  const content = parts.map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('');
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Montado ${baseName} a partir de ${parts.length} partes.`);
}

mergeIfNeeded(path.join(desktopDir, 'src'), 'app.js');
mergeIfNeeded(path.join(desktopDir, 'src'), 'v1.js');
mergeIfNeeded(path.join(desktopDir, 'src'), 'styles.css');
mergeIfNeeded(path.join(desktopDir, 'src'), 'v1.css');
mergeIfNeeded(path.join(desktopDir, 'src'), 'index.html');
mergeIfNeeded(path.join(desktopDir, 'server'), 'server.js');
