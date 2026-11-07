// ITF FFL permits self-hosting for our own website, but not font redistribution
// through a source repository. Obtain the unmodified official binary at build.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const destination=new URL('./assets/fonts/satoshi-variable.woff2',import.meta.url);
const source='https://cdn.fontshare.com/wf/NWBQYJIM7GCZ5XWD7D26ARB3VDY55ZRT/K63EV2KZIGKLE7RANQ2U42S6SVHU5RJ7/X6XYTKIVDUW7GZTZPZNN4EUM5KH54KHF.woff2';
const expected='e739aff9b4d02c264341d6d4872edcda28e79373aeda936f659566a1cd3eb47f';
const matches=bytes=>createHash('sha256').update(bytes).digest('hex')===expected;
let bytes=await readFile(destination).catch(()=>null);
if(!bytes||!matches(bytes)){
  bytes=execFileSync('curl',['--fail','--silent','--show-error','--proto','=https','--tlsv1.2','--connect-timeout','15','--max-time','60','--retry','2',source],{maxBuffer:1024*1024});
  if(!matches(bytes))throw new Error('Official Satoshi font checksum changed; review the source before publishing.');
  await writeFile(destination,bytes);
}
console.log('Satoshi: official self-hosted WOFF2 verified (SHA-256).');
