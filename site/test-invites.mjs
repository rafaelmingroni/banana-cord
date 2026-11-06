import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const invite = (await readFile(new URL('./invite.html',import.meta.url),'utf8')).match(/<script>([\s\S]*?)<\/script>/)[1];
const homepage = await readFile(new URL('./app.js',import.meta.url),'utf8');
const asset = {name:'Mingrx-Setup-3.1.8-x64.exe',browser_download_url:'https://github.com/rafaelmingroni/mingrx-app/releases/download/v3.1.8/Mingrx-Setup-3.1.8-x64.exe'};
function fixture(search){
  const elements = Object.fromEntries(['code','status','openApp','download'].map(id=>[id,{style:{},href:'',textContent:''}]));
  const download = {href:'',dataset:{},removeAttribute(){}};
  const timers=[];
  const context={URLSearchParams,URL,Date,Promise,encodeURIComponent,
    location:{search,replace(url){this.redirect=url;}},
    document:{hidden:false,getElementById:id=>elements[id]||null,addEventListener(){},querySelector:()=>null,querySelectorAll:selector=>selector==='.download-link'?[download]:[]},
    window:{matchMedia:()=>({matches:true})},localStorage:{getItem:()=>null,setItem(){}},
    fetch:async url=>{assert.equal(url,'https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest');return {ok:true,json:async()=>({tag_name:'v3.1.8',assets:[asset]})}},
    setTimeout(fn,delay){timers.push({fn,delay});}
  };
  vm.createContext(context);
  return {context,elements,timers,download};
}
for(const code of ['ABCD2345','ABCD-2345','ABCD-EFGH-2345']){
  const f=fixture(`?invite=${encodeURIComponent(code)}`);
  vm.runInContext(homepage,f.context);
  assert.equal(f.context.location.redirect,`./invite.html?invite=${encodeURIComponent(code)}`);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.download.href,asset.browser_download_url,'home download must select the real installer asset');
  vm.runInContext(invite,f.context);
  await new Promise(resolve=>setImmediate(resolve));
  const formatted=code.replace(/-/g,'').match(/.{1,4}/g).join('-');
  assert.equal(f.elements.code.textContent,formatted);
  assert.equal(f.elements.openApp.href,`mingrx://join/${formatted}`);
  assert.equal(f.elements.download.href,asset.browser_download_url,'invite fallback must download the real installer');
  f.timers.find(t=>t.delay===180).fn();
  assert.equal(f.context.location.href,`mingrx://join/${formatted}`,'installed clients receive the same invitation');
  const fallback=f.timers.find(t=>t.delay===1800);
  f.context.document.hidden=true;
  const previous=f.elements.status.textContent;fallback.fn();
  assert.equal(f.elements.status.textContent,previous,'opening the app must not show a false missing-app message');
  f.context.document.hidden=false;fallback.fn();
  assert.match(f.elements.status.textContent,/baixar a versão mais recente/);
}
for(const value of ['', 'BAD', '<script>alert(1)</script>', 'ABCD1234']){
  const f=fixture(`?invite=${encodeURIComponent(value)}`);
  vm.runInContext(invite,f.context);
  assert.equal(f.elements.openApp.style.display,'none');
  assert.equal(f.timers.length,0,'invalid links must not launch a protocol handler');
}
console.log('Public invites: homepage handoff, app protocol, latest installer fallback and invalid codes: OK');
