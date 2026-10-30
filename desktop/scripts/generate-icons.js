const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'assets');
const sourcePath = path.join(outDir, 'banana-cord.png');

if (!fs.existsSync(sourcePath)) {
  throw new Error('assets/banana-cord.png não encontrado.');
}

const png = fs.readFileSync(sourcePath);
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
if (png.length < 24 || !png.subarray(0, 8).equals(signature)) {
  throw new Error('assets/banana-cord.png precisa ser um PNG válido.');
}

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 256 || height !== 256) {
  throw new Error(`O ícone oficial precisa ter 256x256 px. Recebido: ${width}x${height}.`);
}

fs.writeFileSync(path.join(outDir, 'banana-tray.png'), png);

// ICO com PNG comprimido embutido: preserva exatamente a nova identidade visual.
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 0;
header[7] = 0;
header[8] = 0;
header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(outDir, 'banana-cord.ico'), Buffer.concat([header, png]));

console.log('Banana Cord official V2 icon prepared for app, tray and Windows installer.');
