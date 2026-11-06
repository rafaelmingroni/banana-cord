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
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
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
      return res.end(JSON.stringify({tag_name:'v3.1.10',draft:false,prerelease:false,assets:[{name:'Mingrx-Setup-3.1.10-x64.exe',browser_download_url:'https://github.com/rafaelmingroni/mingrx-app/releases/download/v3.1.10/Mingrx-Setup-3.1.10-x64.exe'}]}));
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
    for(let i=0;i<100;i++){if(await js("document.querySelector('.release-note').textContent.includes('3.1.10')"))break;await wait(50);}
    const layout=await js(`(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,images:[...document.images].every(img=>img.complete&&img.naturalWidth>0),heading:document.querySelector('h1').textContent,version:document.querySelector('.release-note').textContent,animations:document.getAnimations().length,radii:[...document.querySelectorAll('.button,.menu-button')].map(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius)),download:document.querySelector('.download-link').href}))()`);
    assert.equal(layout.width,width);assert(!layout.overflow,`Horizontal overflow at ${width}`);assert(layout.images,`Missing image at ${width}`);assert.equal(layout.animations,0);assert(layout.radii.every(radius=>radius<=8));assert.match(layout.version,/3\.1\.10/);assert.match(layout.download,/releases\/download\/v3\.1\.10\/Mingrx-Setup-3\.1\.10-x64\.exe$/);
    if(width<=850){
      await js("document.querySelector('.menu-button').click()");
      assert(await js("document.querySelector('.menu-button').getAttribute('aria-expanded')==='true'&&getComputedStyle(document.querySelector('.topnav')).display==='flex'"));
      await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
      assert.equal(await js("document.querySelector('.menu-button').getAttribute('aria-expanded')"),'false');
      await js("document.querySelector('.menu-button').click();document.querySelector('.topnav a').click()");
      assert.equal(await js("document.querySelector('.menu-button').getAttribute('aria-expanded')"),'false');
      await js('scrollTo(0,0)');
    }
    if(width===1440)await capture('desktop.png');if(width===390)await capture('mobile.png');
    console.log(`Site ${width}px: layout, images, live version, rectangular buttons and navigation passed`);
  }
  for(const page of ['privacy.html','terms.html','support.html','invite.html?invite=BAD','404.html']){
    win.setContentSize(390,844);await win.loadURL(origin+'/'+page);await wait(50);
    assert(await js('document.documentElement.scrollWidth<=innerWidth+1'),`Overflow on ${page}`);
    assert(await js("document.querySelector('h1')?.textContent.length>0"));
    const icon=await js("fetch(document.querySelector('link[rel=icon]').href).then(response=>response.ok)");assert(icon,`Favicon missing on ${page}`);
    console.log(`Site ${page}: mobile layout, heading and favicon passed`);
  }
  assert.deepEqual(unexpectedRequests,[],'Unexpected external resource or tracking request');
  assert.deepEqual(errors,[],'Browser errors');
  finish(0,'Site browser checks: desktop/mobile, menu, assets, factual release, legal pages and no external tracking passed');
}).catch(error=>finish(1,error.stack||String(error)));
