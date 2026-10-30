const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const sourcePath = path.join(assetsDir, 'banana-cord.svg');
const sizes = [16, 24, 32, 48, 64, 128, 256];

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Frame do ícone não é um PNG válido.');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function buildIco(frames) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(frames.length, 4);

  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    const pos = 6 + index * 16;
    header[pos] = size === 256 ? 0 : size;
    header[pos + 1] = size === 256 ? 0 : size;
    header[pos + 2] = 0; // true color
    header[pos + 3] = 0;
    header.writeUInt16LE(1, pos + 4);
    header.writeUInt16LE(32, pos + 6);
    header.writeUInt32LE(png.length, pos + 8);
    header.writeUInt32LE(offset, pos + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...frames.map(frame => frame.png)]);
}

function validateIco(ico, expectedSizes) {
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error('ICO gerado possui cabeçalho inválido.');
  }
  const count = ico.readUInt16LE(4);
  if (count !== expectedSizes.length) {
    throw new Error(`ICO deveria conter ${expectedSizes.length} frames, mas contém ${count}.`);
  }

  const found = [];
  for (let index = 0; index < count; index += 1) {
    const pos = 6 + index * 16;
    const width = ico[pos] || 256;
    const height = ico[pos + 1] || 256;
    const bytes = ico.readUInt32LE(pos + 8);
    const offset = ico.readUInt32LE(pos + 12);
    const frame = ico.subarray(offset, offset + bytes);
    const dimensions = pngDimensions(frame);
    if (width !== height || dimensions.width !== width || dimensions.height !== height) {
      throw new Error(`Frame ICO inválido em ${width}x${height}.`);
    }
    found.push(width);
  }

  if (found.join(',') !== expectedSizes.join(',')) {
    throw new Error(`Resoluções do ICO incorretas: ${found.join(', ')}.`);
  }
}

async function validateVisual(buffer, size) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let dark = 0;
  let yellow = 0;
  const colors = new Set();
  const pixels = info.width * info.height;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 75 && g < 75 && b < 75) dark += 1;
    if (r > 175 && g > 115 && b < 105) yellow += 1;
    colors.add((r << 16) | (g << 8) | b);
  }

  const darkRatio = dark / pixels;
  const yellowRatio = yellow / pixels;
  if (darkRatio < 0.22 || yellowRatio < 0.08 || colors.size < Math.min(48, pixels / 3)) {
    throw new Error(
      `Ícone ${size}px falhou na validação visual: dark=${darkRatio.toFixed(3)}, yellow=${yellowRatio.toFixed(3)}, colors=${colors.size}.`
    );
  }

  return { darkRatio, yellowRatio, colors: colors.size };
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('assets/banana-cord.svg não encontrado.');
  }

  const svg = fs.readFileSync(sourcePath);
  if (!svg.includes(Buffer.from('<svg')) || !svg.includes(Buffer.from('viewBox="0 0 1024 1024"'))) {
    throw new Error('Fonte vetorial oficial do Banana Cord está inválida.');
  }

  const frames = [];
  for (const size of sizes) {
    const png = await sharp(svg, { density: Math.max(144, size * 4) })
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    const dimensions = pngDimensions(png);
    if (dimensions.width !== size || dimensions.height !== size) {
      throw new Error(`Renderização ${size}px saiu em ${dimensions.width}x${dimensions.height}.`);
    }
    frames.push({ size, png });
  }

  // Validamos tamanhos pequenos e grandes para impedir regressões como o
  // quadrado amarelo que apareceu no atalho da V2.0.12.
  const check32 = await validateVisual(frames.find(frame => frame.size === 32).png, 32);
  const check256 = await validateVisual(frames.find(frame => frame.size === 256).png, 256);

  const appPng = frames.find(frame => frame.size === 256).png;
  const trayPng = frames.find(frame => frame.size === 32).png;
  const ico = buildIco(frames);
  validateIco(ico, sizes);

  fs.writeFileSync(path.join(assetsDir, 'banana-cord.png'), appPng);
  fs.writeFileSync(path.join(assetsDir, 'banana-tray.png'), trayPng);
  fs.writeFileSync(path.join(assetsDir, 'banana-cord.ico'), ico);

  console.log(
    `Banana Cord icon OK: ICO=${sizes.join('/')}px; app=256px; tray=32px; ` +
    `32px dark=${Math.round(check32.darkRatio * 100)}% yellow=${Math.round(check32.yellowRatio * 100)}%; ` +
    `256px dark=${Math.round(check256.darkRatio * 100)}% yellow=${Math.round(check256.yellowRatio * 100)}%.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
