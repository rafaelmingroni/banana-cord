import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const invite=await readFile(new URL('./invite.js',import.meta.url),'utf8');
const homepage=await readFile(new URL('./app.js',import.meta.url),'utf8');
const asset={name:'Mingrx-Setup-3.2.0-x64.exe',browser_download_url:'https://github.com/rafaelmingroni/mingrx-app/releases/download/v3.2.0/Mingrx-Setup-3.2.0-x64.exe'};
function fixture(search,mode='success'){
  const elements=Object.fromEntries(['code','status','openApp','download'].map(id=>[id,{style:{},href:'https://github.com/rafaelmingroni/mingrx-app/releases/latest',textContent:''}]));
  const download={href:'https://github.com/rafaelmingroni/mingrx-app/releases/latest'},note={textContent:'Windows 10 e 11.'};
  const timers=[];
  const context={URLSearchParams,URL,Date,Promise,AbortController,encodeURIComponent,
    location:{search,replace(url){this.redirect=url}},
    document:{hidden:false,getElementById:id=>elements[id]||null,addEventListener(){},querySelector:()=>null,querySelectorAll:selector=>selector==='.download-link'?[download]:selector==='.release-note'?[note]:[]},
    window:{},fetch:async url=>{assert.equal(url,'https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest');if(mode==='offline')throw new Error('Offline');return{ok:true,json:async()=>({tag_name:mode==='malicious'?'unverified <script>':'v3.2.0',assets:[mode==='malicious'?{...asset,browser_download_url:'https://other.example/installer.exe'}:asset]})}},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length},clearTimeout(){}
  };
  vm.createContext(context);return{context,elements,timers,download,note};
}
for(const mode of ['success','offline','malicious']){
  const f=fixture('',mode);vm.runInContext(homepage,f.context);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.download.href,mode==='success'?asset.browser_download_url:'https://github.com/rafaelmingroni/mingrx-app/releases/latest');
  if(mode==='success'){assert.match(f.note.textContent,/Mingrx 3\.2\./);assert(!f.note.textContent.includes('3.2.0'),'Public label must hide the technical patch zero');}
  else assert(!f.note.textContent.includes('<script>'));
}
for(const code of ['ABCD2345','ABCD-2345','ABCD-EFGH-2345']){
  const f=fixture(`?invite=${encodeURIComponent(code)}`);vm.runInContext(homepage,f.context);
  assert.equal(f.context.location.redirect,`./invite.html?invite=${encodeURIComponent(code)}`);
  vm.runInContext(invite,f.context);await new Promise(resolve=>setImmediate(resolve));
  const formatted=code.replace(/-/g,'').match(/.{1,4}/g).join('-');
  assert.equal(f.elements.code.textContent,formatted);assert.equal(f.elements.openApp.href,`mingrx://join/${formatted}`);assert.equal(f.elements.download.href,asset.browser_download_url);
  f.timers.find(t=>t.delay===180).fn();assert.equal(f.context.location.href,`mingrx://join/${formatted}`);
  const fallback=f.timers.find(t=>t.delay===1800);f.context.document.hidden=true;const old=f.elements.status.textContent;fallback.fn();assert.equal(f.elements.status.textContent,old);
  f.context.document.hidden=false;fallback.fn();assert.match(f.elements.status.textContent,/baixar a versão mais recente/);
  for(const mode of ['offline','malicious']){const trial=fixture(`?invite=${encodeURIComponent(code)}`,mode);vm.runInContext(invite,trial.context);await new Promise(resolve=>setImmediate(resolve));assert.equal(trial.elements.download.href,'https://github.com/rafaelmingroni/mingrx-app/releases/latest','Invitation must preserve trusted fallback on API failure or malicious asset');}
}
for(const code of ['', 'BAD','<script>alert(1)</script>','ABCD1234']){
  const f=fixture(`?invite=${encodeURIComponent(code)}`);vm.runInContext(invite,f.context);assert.equal(f.elements.openApp.style.display,'none');assert.equal(f.timers.length,0);
}
console.log('Downloads and invitations: official asset, offline fallback, untrusted URL rejection, protocol handoff and invalid codes passed.');
