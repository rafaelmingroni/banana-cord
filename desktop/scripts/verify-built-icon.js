const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

async function main(){
  if(process.platform!=='win32'){console.log('Embedded Mingrx Windows icon verification skipped outside Windows.');return;}
  const exePath=path.join(__dirname,'..','dist','win-unpacked','Mingrx.exe');
  if(!fs.existsSync(exePath))throw new Error(`Executável Mingrx não encontrado: ${exePath}`);
  const pngPath=path.join(os.tmpdir(),`mingrx-embedded-icon-${process.pid}.png`);
  const escapedExe=exePath.replace(/'/g,"''"),escapedPng=pngPath.replace(/'/g,"''");
  const ps=`Add-Type -AssemblyName System.Drawing\n$icon=[System.Drawing.Icon]::ExtractAssociatedIcon('${escapedExe}')\nif($null -eq $icon){throw 'Não foi possível extrair o ícone.'}\n$bmp=$icon.ToBitmap()\n$bmp.Save('${escapedPng}',[System.Drawing.Imaging.ImageFormat]::Png)\n$bmp.Dispose()\n$icon.Dispose()`;
  const run=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{encoding:'utf8',windowsHide:true});
  if(run.status!==0)throw new Error(`Falha ao extrair ícone Mingrx: ${run.stderr||run.stdout}`);
  const {data,info}=await sharp(pngPath).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let dark=0,purple=0;const colors=new Set();const pixels=info.width*info.height;
  for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2];if(r<55&&g<55&&b<70)dark+=1;if(b>145&&r>70&&r<195&&g<150)purple+=1;colors.add((r<<16)|(g<<8)|b);}
  try{fs.unlinkSync(pngPath)}catch{}
  const darkRatio=dark/pixels,purpleRatio=purple/pixels;
  if(info.width<32||info.height<32)throw new Error(`Ícone Mingrx pequeno demais: ${info.width}x${info.height}`);
  if(darkRatio<.20)throw new Error(`Ícone Mingrx perdeu base escura (${(darkRatio*100).toFixed(1)}%).`);
  if(purpleRatio<.04)throw new Error(`Ícone Mingrx perdeu o violeta (${(purpleRatio*100).toFixed(1)}%).`);
  if(colors.size<24)throw new Error(`Ícone Mingrx perdeu detalhes: ${colors.size} cores.`);
  console.log(`Mingrx embedded icon verification: OK (${info.width}x${info.height})`);
}
main().catch(error=>{console.error(error);process.exit(1);});