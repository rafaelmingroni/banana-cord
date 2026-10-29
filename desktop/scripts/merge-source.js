const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function numericPart(name) {
  const m = name.match(/\.part(\d+)$/);
  return m ? Number(m[1]) : 999999;
}

function merge(baseName) {
  const prefix = `${baseName}.part`;
  const parts = fs.readdirSync(srcDir)
    .filter(name => name.startsWith(prefix))
    .sort((a, b) => numericPart(a) - numericPart(b));

  if (!parts.length) {
    if (fs.existsSync(path.join(srcDir, baseName))) return;
    throw new Error(`Nenhuma parte encontrada para ${baseName}`);
  }

  const content = parts.map(name => fs.readFileSync(path.join(srcDir, name), 'utf8')).join('');
  fs.writeFileSync(path.join(srcDir, baseName), content, 'utf8');
  console.log(`Montado ${baseName} a partir de ${parts.length} partes.`);
}

merge('app.js');
merge('styles.css');
