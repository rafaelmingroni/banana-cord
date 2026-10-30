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
if (width !== height || width < 128 || width > 256) {
  throw new Error(`O ícone oficial precisa ser quadrado entre 128 e 256 px. Recebido: ${width}x${height}.`);
}

// O mesmo artwork oficial é usado na UI e na bandeja. Electron faz a redução
// nativa para os tamanhos menores sem redesenhar a marca.
fs.writeFileSync(path.join(outDir, 'banana-tray.png'), png);

// ICO com frame PNG comprimido embutido. Isso preserva a arte oficial sem o
// gerador procedural antigo sobrescrever a banana escolhida para a V2.0.12.
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = width === 256 ? 0 : width;
header[7] = height === 256 ? 0 : height;
header[8] = 0;
header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(outDir, 'banana-cord.ico'), Buffer.concat([header, png]));

console.log(`Banana Cord official V2 icon prepared (${width}x${height}) for app, tray and Windows installer.`);
