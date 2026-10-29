const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
}

function png(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const mask = new Uint8Array(size * size);
  const rot = -0.26;
  const cs = Math.cos(rot), sn = Math.sin(rot);

  const inside = (px, py) => {
    let x = (px / (size - 1) - 0.5) * 2.15;
    let y = (py / (size - 1) - 0.5) * 2.15;
    const rx = x * cs - y * sn;
    const ry = x * sn + y * cs;
    x = rx; y = ry;

    const outer = (x * x) / (0.91 * 0.91) + ((y - 0.03) * (y - 0.03)) / (0.54 * 0.54) <= 1;
    const inner = (x * x) / (0.64 * 0.64) + ((y + 0.17) * (y + 0.17)) / (0.30 * 0.30) <= 1;
    const body = outer && !inner && y > -0.20;

    const leftTip = ((x + 0.84) ** 2) / (0.14 ** 2) + ((y - 0.03) ** 2) / (0.13 ** 2) <= 1;
    const rightTip = ((x - 0.79) ** 2) / (0.12 ** 2) + ((y - 0.03) ** 2) / (0.14 ** 2) <= 1;
    return body || leftTip || rightTip;
  };

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (inside(x, y)) mask[y * size + x] = 1;
  }

  const edgeRadius = Math.max(1, Math.round(size / 72));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const idx = y * size + x;
    if (!mask[idx]) continue;

    let edge = false;
    for (let oy = -edgeRadius; oy <= edgeRadius && !edge; oy++) {
      for (let ox = -edgeRadius; ox <= edgeRadius; ox++) {
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size || !mask[yy * size + xx]) { edge = true; break; }
      }
    }

    let nx = (x / (size - 1) - 0.5) * 2.15;
    let ny = (y / (size - 1) - 0.5) * 2.15;
    const rx = nx * cs - ny * sn, ry = nx * sn + ny * cs;
    nx = rx; ny = ry;

    const tip = (((nx + 0.84) ** 2) / (0.14 ** 2) + ((ny - 0.03) ** 2) / (0.13 ** 2) <= 1) ||
                (((nx - 0.79) ** 2) / (0.12 ** 2) + ((ny - 0.03) ** 2) / (0.14 ** 2) <= 1);

    let r, g, b;
    if (edge) { r = 69; g = 42; b = 8; }
    else if (tip) { r = 116; g = 70; b = 15; }
    else {
      const t = Math.max(0, Math.min(1, (ny + 0.35) / 0.78));
      const shine = Math.exp(-((nx + 0.18) ** 2) / 0.09 - ((ny - 0.08) ** 2) / 0.03);
      r = Math.round(255 - 15 * t);
      g = Math.round(220 - 55 * t + 25 * shine);
      b = Math.round(48 - 34 * t + 45 * shine);
    }

    const o = idx * 4;
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
  }

  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0;
    rgba.copy(raw, y * row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function ico(sizes) {
  const images = sizes.map(png);
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const o = 6 + i * 16;
    header[o] = size >= 256 ? 0 : size;
    header[o + 1] = size >= 256 ? 0 : size;
    header[o + 2] = 0;
    header[o + 3] = 0;
    header.writeUInt16LE(1, o + 4);
    header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(images[i].length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

fs.writeFileSync(path.join(outDir, 'banana-cord.png'), png(512));
fs.writeFileSync(path.join(outDir, 'banana-tray.png'), png(64));
fs.writeFileSync(path.join(outDir, 'banana-cord.ico'), ico([16,20,24,32,40,48,64,128,256]));
console.log('Banana Cord icons generated.');
