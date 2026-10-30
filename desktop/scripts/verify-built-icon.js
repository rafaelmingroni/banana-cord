const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

async function main() {
  if (process.platform !== 'win32') {
    console.log('Embedded Windows icon verification skipped outside Windows.');
    return;
  }

  const exePath = path.join(__dirname, '..', 'dist', 'win-unpacked', 'Banana Cord.exe');
  if (!fs.existsSync(exePath)) throw new Error(`Executável não encontrado: ${exePath}`);

  const pngPath = path.join(os.tmpdir(), `banana-cord-embedded-icon-${process.pid}.png`);
  const escapedExe = exePath.replace(/'/g, "''");
  const escapedPng = pngPath.replace(/'/g, "''");
  const ps = `
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${escapedExe}')
if ($null -eq $icon) { throw 'Não foi possível extrair o ícone do executável.' }
$bmp = $icon.ToBitmap()
$bmp.Save('${escapedPng}', [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ("Embedded icon extracted: {0}x{1}" -f $bmp.Width, $bmp.Height)
$bmp.Dispose()
$icon.Dispose()
`;

  const run = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (run.status !== 0) {
    throw new Error(`Falha ao extrair ícone do EXE: ${run.stderr || run.stdout}`);
  }
  process.stdout.write(run.stdout || '');

  const { data, info } = await sharp(pngPath)
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
  console.log(
    `Embedded icon stats: ${info.width}x${info.height}, colors=${colors.size}, ` +
    `dark=${Math.round(darkRatio * 100)}%, yellow=${Math.round(yellowRatio * 100)}%`
  );

  try { fs.unlinkSync(pngPath); } catch {}

  // O bug da 2.0.12 virava praticamente um bloco amarelo. Estes limites exigem
  // contraste real e diversidade de cores no ícone que foi efetivamente embutido.
  if (info.width < 32 || info.height < 32) {
    throw new Error(`Ícone embutido pequeno demais: ${info.width}x${info.height}.`);
  }
  if (darkRatio < 0.20) {
    throw new Error(`Ícone embutido tem pouca área escura (${(darkRatio * 100).toFixed(1)}%).`);
  }
  if (yellowRatio < 0.07) {
    throw new Error(`Ícone embutido perdeu a banana/amarelo (${(yellowRatio * 100).toFixed(1)}%).`);
  }
  if (colors.size < 48) {
    throw new Error(`Ícone embutido perdeu detalhes: somente ${colors.size} cores detectadas.`);
  }

  console.log('Banana Cord embedded Windows icon verification: OK');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
