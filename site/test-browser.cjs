// Run with the pinned Electron binary from desktop/node_modules. Tests the
// actual public pages; only the GitHub release API is replaced by a fixture.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {app,BrowserWindow,session}=require('electron');
const root=__dirname;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mingrx-site-browser-'));
app.setPath('userData',profile);
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.on('window-all-closed',()=>{});
let win,server,finished=false;
const errors=[],unexpectedRequests=[];
const deadline=setTimeout(()=>finish(1,'Site browser checks timed out'),60000);
function finish(code,message){if(finished)return;finished=true;clearTimeout(deadline);(code?console.error:console.log)(message);try{win?.destroy();server?.close();fs.rmSync(profile,{recursive:true,force:true})}catch{}app.exit(code)}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const js=code=>win.webContents.executeJavaScript(code,true);
async function press(keyCode,modifiers=[]){
  win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});
  if(keyCode==='Enter'||keyCode==='Space')win.webContents.sendInputEvent({type:'char',keyCode:keyCode==='Enter'?'\r':' ',modifiers});
  win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});
  await wait(50);
}
function contrast(foreground,background){
  const luminance=color=>{const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]};
  const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf','.woff2':'font/woff2'};
async function capture(name){
  if(!process.env.MINGRX_SITE_PREVIEWS)return;
  await js('history.replaceState(null,"","/");document.activeElement?.blur();scrollTo(0,0);void 0;');
  await wait(120);win.webContents.invalidate();await wait(50);
  fs.writeFileSync(path.join(process.env.MINGRX_SITE_PREVIEWS,name.replace('.png','-viewport.png')),(await win.webContents.capturePage()).toPNG());
  const height=await js('document.documentElement.scrollHeight');
  if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');
  const result=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:await js('innerWidth'),height,scale:1}});
  fs.writeFileSync(path.join(process.env.MINGRX_SITE_PREVIEWS,name),Buffer.from(result.data,'base64'));
}
app.whenReady().then(async()=>{
  server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/test-release'){
      res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      return res.end(JSON.stringify({tag_name:'v3.2.0',draft:false,prerelease:false,assets:[{name:'Mingrx-Setup-3.2.0-x64.exe',browser_download_url:'https://github.com/rafaelmingroni/mingrx-app/releases/download/v3.2.0/Mingrx-Setup-3.2.0-x64.exe'}]}));
    }
    let file=path.join(root,decodeURIComponent(pathname));
    if(pathname.endsWith('/'))file=path.join(file,'index.html');
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
    try{const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const isolated=session.fromPartition('persist:site-review');
  isolated.webRequest.onBeforeRequest((details,done)=>{
    if(details.url==='https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest')return done({redirectURL:origin+'/test-release'});
    if(/^https?:/.test(details.url)&&!details.url.startsWith(origin+'/')){unexpectedRequests.push(details.url);return done({cancel:true})}
    done({});
  });
  win=new BrowserWindow({show:true,width:1440,height:1000,webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  win.webContents.on('console-message',event=>{if(event.level==='error'||event.level===3)errors.push(event.message)});
  win.webContents.on('render-process-gone',(_event,details)=>finish(1,'Site renderer exited: '+details.reason));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url.startsWith('mingrx:'))event.preventDefault()});
  for(const [width,height]of [[1440,1000],[1024,900],[768,900],[390,844],[320,720]]){
    win.setContentSize(width,height);await win.loadURL(origin+'/');
    await js('document.fonts.ready');
    assert(await js("document.fonts.check('750 32px Satoshi')&&[...document.fonts].some(font=>font.family==='Satoshi'&&font.status==='loaded')"),'The locally hosted Satoshi font must load');
    for(let i=0;i<100;i++){if(await js("document.querySelector('.release-note').textContent.includes('Mingrx 3.2.')"))break;await wait(50);}
    const layout=await js(`(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,images:[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.top<innerHeight&&r.bottom>0}).every(img=>img.complete&&img.naturalWidth>0),heading:document.querySelector('h1').textContent,version:document.querySelector('.release-note').textContent,animations:document.getAnimations().length,radii:[...document.querySelectorAll('.button,.menu-button')].map(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)),download:document.querySelector('.download-link').href}))()`);
    assert.equal(layout.width,width);assert(!layout.overflow,`Horizontal overflow at ${width}`);assert(layout.images,`Missing image at ${width}`);assert.equal(layout.animations,0);assert(layout.radii.every(radius=>radius<=8));assert.match(layout.version,/Mingrx 3\.2\./);assert.match(layout.download,/releases\/download\/v3\.2\.0\/Mingrx-Setup-3\.2\.0-x64\.exe$/);
    assert(await js("[...document.images].every(img=>img.hasAttribute('alt'))&&document.querySelector('.product-image img').alt.length>30"),'Image alternatives are missing');
    if(width===1440){
      const colors=await js("(()=>{const body=getComputedStyle(document.body),copy=getComputedStyle(document.querySelector('.hero-description')),button=getComputedStyle(document.querySelector('.hero-actions .button-primary'));return{body:body.color,bg:body.backgroundColor,muted:copy.color,button:button.color,buttonBg:button.backgroundColor}})()");
      assert(contrast(colors.body,colors.bg)>=4.5&&contrast(colors.muted,colors.bg)>=4.5&&contrast(colors.button,colors.buttonBg)>=4.5,'Text contrast below 4.5:1');
      win.webContents.focus();await press('Tab');
      assert(await js("document.activeElement.classList.contains('skip-link')"),'First Tab must reach the skip link');
      await press('Enter');assert.equal(await js('document.activeElement.id'),'conteudo');
      await js("document.getElementById('tab-conversation').focus()");await press('Right');
      assert(await js("document.getElementById('tab-call').getAttribute('aria-selected')==='true'&&!document.getElementById('scene-call').hidden&&document.getElementById('scene-conversation').hidden"),'ArrowRight must select the call scene');
      await js("document.querySelector('#scene-call img').decode()");
      await press('Home');assert.equal(await js('document.activeElement.id'),'tab-conversation');
      assert(await js("!document.getElementById('scene-conversation').hidden&&document.getElementById('scene-call').hidden"));
      await js("document.querySelector('summary').focus()");await press('Space');
      assert(await js("document.querySelector('details').open"),'Space must open the FAQ');
      await press('Enter');assert(!(await js("document.querySelector('details').open")),'Enter must close the FAQ');
    }
    if(width<=850){
      await js("document.querySelector('.menu-button').focus()");await press('Space');
      assert(await js("document.querySelector('.menu-button').getAttribute('aria-expanded')==='true'&&getComputedStyle(document.querySelector('.topnav')).display==='flex'"));
      await press('Escape');
      assert.equal(await js("document.querySelector('.menu-button').getAttribute('aria-expanded')"),'false');
      assert(await js("document.activeElement.classList.contains('menu-button')"),'Escape must restore menu focus');
      await press('Space');await press('Tab');
      assert(await js("document.activeElement.matches('.topnav a')"),'Tab must reach an open menu link');
      await press('Enter');
      assert.equal(await js("document.querySelector('.menu-button').getAttribute('aria-expanded')"),'false');
      assert.equal(await js('document.activeElement.id'),'recursos','In-page navigation must focus its destination');
      await js('scrollTo(0,0)');
    }
    if(width===390){
      await js("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Permission denied')}}});document.querySelector('[data-copy-site]').click();void 0");await wait(30);
      assert(await js("document.querySelector('.pc-link .copy-fallback').hidden===false&&document.querySelector('.pc-link .copy-status').textContent.includes('Não foi possível')"),'Clipboard denial must reveal a selectable URL');
      await js("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});document.querySelector('[data-copy-site]').click();void 0");await wait(30);
      assert(await js("document.querySelector('.pc-link .copy-fallback').hidden&&document.querySelector('.pc-link .copy-status').textContent.includes('Link copiado')"),'Clipboard success must announce completion');
    }
    if(width===1440)await capture('desktop.png');if(width===390)await capture('mobile.png');
    console.log(`Site ${width}px: layout, images, live version, rectangular buttons and navigation passed`);
  }
  win.setContentSize(1440,1000);await win.loadURL(origin+'/');win.webContents.setZoomFactor(2);await wait(100);
  assert(await js('document.documentElement.scrollWidth<=innerWidth+1'),'Content must reflow at 200% zoom');win.webContents.setZoomFactor(1);
  for(const page of ['privacy.html','terms.html','support.html','accessibility.html','about.html','invite.html?invite=BAD','404.html']){
    win.setContentSize(390,844);await win.loadURL(origin+'/'+page);await wait(50);
    assert(await js('document.documentElement.scrollWidth<=innerWidth+1'),`Overflow on ${page}`);
    assert(await js("document.querySelector('h1')?.textContent.length>0"));
    if(page==='support.html')assert(await js("document.querySelector('.support-topics').getBoundingClientRect().top<700"),'Support tasks must precede the contact block');
    if(page==='privacy.html')assert(await js("!document.querySelector('.legal-toc').open&&document.querySelector('h1').getBoundingClientRect().top<250"),'Mobile legal page must show its title before collapsed contents');
    if(page.startsWith('invite.html'))assert(await js("!document.getElementById('inviteRecovery').hidden&&getComputedStyle(document.getElementById('openApp')).display==='none'"),'Invalid invitation must direct the visitor to request a new link');
    const icon=await js("fetch(document.querySelector('link[rel=icon]').href).then(response=>response.ok)");assert(icon,`Favicon missing on ${page}`);
    console.log(`Site ${page}: mobile layout, heading and favicon passed`);
  }
  assert.deepEqual(await isolated.cookies.get({url:origin}),[],'Site scripts must not create tracking cookies');
  assert(await js('localStorage.length===0&&sessionStorage.length===0'),'Site must not retain tracking identifiers');
  assert.deepEqual(unexpectedRequests,[],'Unexpected external resource or tracking request');
  assert.deepEqual(errors,[],'Browser errors');
  finish(0,'Site browser checks: desktop/mobile, menu, assets, factual release, legal pages and no external tracking passed');
}).catch(error=>finish(1,error.stack||String(error)));
