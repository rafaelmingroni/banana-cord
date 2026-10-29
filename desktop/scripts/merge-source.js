const fs = require('fs');
const path = require('path');

const desktopDir = path.join(__dirname, '..');

function numericPart(name) {
  const m = name.match(/\.part(\d+)$/);
  return m ? Number(m[1]) : 999999;
}

function merge(dir, baseName) {
  const prefix = `${baseName}.part`;
  const parts = fs.readdirSync(dir)
    .filter(name => name.startsWith(prefix))
    .sort((a, b) => numericPart(a) - numericPart(b));

  if (!parts.length) {
    if (fs.existsSync(path.join(dir, baseName))) return;
    throw new Error(`Nenhuma parte encontrada para ${baseName}`);
  }

  const content = parts.map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('');
  fs.writeFileSync(path.join(dir, baseName), content, 'utf8');
  console.log(`Montado ${baseName} a partir de ${parts.length} partes.`);
}

merge(path.join(desktopDir, 'src'), 'app.js');
merge(path.join(desktopDir, 'src'), 'styles.css');
merge(path.join(desktopDir, 'server'), 'server.js');
