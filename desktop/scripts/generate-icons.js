const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const sourcePath = path.join(assetsDir, 'mingrx.svg');
const sizes = [16, 24, 32, 48, 64, 128, 256];

function pngDimensions(buffer) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || !buffer.subarray(0,8).equals(signature)) throw new Error('Frame PNG inválido.');
  return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
}

function buildIco(frames) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(frames.length,4);
  let offset = header.length;
  frames.forEach(({size,png},index) => {
    const pos = 6 + index * 16;
    header[pos] = size === 256 ? 0 : size; header[pos+1] = size === 256 ? 0 : size;
    header[pos+2]=0; header[pos+3]=0; header.writeUInt16LE(1,pos+4); header.writeUInt16LE(32,pos+6);
    header.writeUInt32LE(png.length,pos+8); header.writeUInt32LE(offset,pos+12); offset += png.length;
  });
  return Buffer.concat([header,...frames.map(frame=>frame.png)]);
}

function validateIco(ico, expectedSizes) {
  if (ico.readUInt16LE(0)!==0 || ico.readUInt16LE(2)!==1) throw new Error('ICO Mingrx inválido.');
  const count=ico.readUInt16LE(4); if(count!==expectedSizes.length) throw new Error('Quantidade de frames ICO incorreta.');
  const found=[];
  for(let i=0;i<count;i+=1){const pos=6+i*16;const width=ico[pos]||256;const bytes=ico.readUInt32LE(pos+8);const offset=ico.readUInt32LE(pos+12);const d=pngDimensions(ico.subarray(offset,offset+bytes));if(d.width!==width||d.height!==width)throw new Error(`Frame Mingrx ${width}px inválido.`);found.push(width);}
  if(found.join(',')!==expectedSizes.join(','))throw new Error(`Resoluções Mingrx incorretas: ${found.join(',')}`);
}

async function validateVisual(buffer,size){
  const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let dark=0,purple=0;const colors=new Set();const pixels=info.width*info.height;
  for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2];if(r<55&&g<55&&b<70)dark+=1;if(b>150&&r>75&&r<190&&g<145)purple+=1;colors.add((r<<16)|(g<<8)|b);}
  const darkRatio=dark/pixels,purpleRatio=purple/pixels;
  if(darkRatio<.28||purpleRatio<.05||colors.size<Math.min(24,pixels/4))throw new Error(`Ícone Mingrx ${size}px falhou: dark=${darkRatio.toFixed(3)} purple=${purpleRatio.toFixed(3)} colors=${colors.size}`);
  return {darkRatio,purpleRatio,colors:colors.size};
}

async function main(){
  if(!fs.existsSync(sourcePath))throw new Error('assets/mingrx.svg não encontrado.');
  const svg=fs.readFileSync(sourcePath);
  if(!svg.includes(Buffer.from('<svg'))||!svg.includes(Buffer.from('viewBox="0 0 1024 1024"')))throw new Error('Fonte vetorial Mingrx inválida.');
  const frames=[];
  for(const size of sizes){const png=await sharp(svg,{density:Math.max(144,size*4)}).resize(size,size,{fit:'fill',kernel:sharp.kernel.lanczos3}).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();const d=pngDimensions(png);if(d.width!==size||d.height!==size)throw new Error(`Renderização Mingrx ${size}px inválida.`);frames.push({size,png});}
  const check32=await validateVisual(frames.find(f=>f.size===32).png,32);const check256=await validateVisual(frames.find(f=>f.size===256).png,256);
  const ico=buildIco(frames);validateIco(ico,sizes);
  fs.writeFileSync(path.join(assetsDir,'mingrx.png'),frames.find(f=>f.size===256).png);
  fs.writeFileSync(path.join(assetsDir,'mingrx-tray.png'),frames.find(f=>f.size===32).png);
  fs.writeFileSync(path.join(assetsDir,'mingrx.ico'),ico);
  console.log(`Mingrx icon OK: ${sizes.join('/')}px; 32px dark=${Math.round(check32.darkRatio*100)}% purple=${Math.round(check32.purpleRatio*100)}%; 256px dark=${Math.round(check256.darkRatio*100)}% purple=${Math.round(check256.purpleRatio*100)}%`);
}
main().catch(error=>{console.error(error);process.exit(1);});
