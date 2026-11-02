const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('update:get-config', async () => ({ repoUrl:'', autoCheck:true, autoDownload:true, currentVersion:'2.1.0' }));
ipcMain.handle('update:get-state', async () => ({ status:'idle', progress:0, message:'' }));
ipMainHandleSafe('clipboard:write', async () => true);
ipMainHandleSafe('banana-updater:get-state', async () => ({ phase:'idle', version:'2.1.0', percent:0 }));
ipMainHandleSafe('banana-updater:get-version', async () => '2.1.0');
ipMainHandleSafe('banana-updater:check', async () => ({ ok:true }));
ipMainHandleSafe('banana-v21:get-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false }));
ipMainHandleSafe('banana-v21:set-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false }));
ipMainHandleSafe('banana-v21:get-system-languages', async () => ['pt-BR']);

function ipMainHandleSafe(channel, handler){
  try { ipcMain.handle(channel, handler); } catch {}
}

const hardTimeout = setTimeout(() => {
  console.error('Mingrx layout E2E failed: hard timeout');
  app.exit(1);
}, 24000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
}
const fail = message => finish(1, `Mingrx layout E2E failed: ${message}`);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1280, height:720, webPreferences:{ nodeIntegration:true, contextIsolation:false, sandbox:false } });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(220);

  const prepared = await win.webContents.executeJavaScript(`
    (() => {
      const fake={connected:true,on(){return this},off(){return this},emit(_event,_payload,ack){ack?.({ok:true});return this}};
      const now=Date.now();
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.socket=fake;
      state.viewMode='dm';
      state.activeDmUserId='peer';
      state.selectedServer=null;
      state.selectedChannel=null;
      state.dmConversations=[{user:{id:'peer',name:'Gustavo Pioto',status:'online',avatar:''},lastMessage:{text:'oi',at:now}}];
      state.dmMessages.set('peer',Array.from({length:40},(_,i)=>({id:'dm'+i,fromId:i%2?'peer':'me',toId:i%2?'me':'peer',text:i===12?'https://example.com/'+'x'.repeat(240):'Mensagem privada '+i,at:now+i,reactions:{},e2ee:true})));
      state.v1=state.v1||{};state.v1.social=state.v1.social||{};state.v1.social.friends=[{id:'peer',name:'Gustavo Pioto',status:'online',avatar:''}];
      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      els.app.classList.add('dm-mode');
      els.emptyView.classList.add('hidden');
      els.textView.classList.remove('hidden');
      els.voiceView.classList.add('hidden');
      renderDmSidebar();
      renderDmMessages();
      return true;
    })();
  `, true);
  if (!prepared) return fail('could not prepare DM state');

  async function measure(label, width, height) {
    win.setContentSize(width, height);
    await sleep(120);
    const result = await win.webContents.executeJavaScript(`
      (async()=>{
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const rect = el => { const r=el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
        const main=document.querySelector('.main');
        const text=document.getElementById('textView');
        const messages=document.getElementById('messages');
        const composer=document.getElementById('messageForm');
        const sidebar=document.querySelector('.sidebar');
        const dmSidebar=document.querySelector('.dm-sidebar');
        const before={main:rect(main),text:rect(text),messages:rect(messages),composer:rect(composer),sidebar:rect(sidebar),dmSidebar:dmSidebar?rect(dmSidebar):null,innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth};
        const fail=[];
        if(before.sidebar.width < 292) fail.push('private sidebar narrower than 292px');
        if(before.dmSidebar && before.dmSidebar.width < 260) fail.push('inner DM sidebar collapsed');
        if(before.text.width < before.main.width*.97) fail.push('textView not fluid');
        if(before.messages.width < before.main.width*.97) fail.push('messages not fluid');
        if(before.composer.width < before.main.width*.97) fail.push('composer not fluid');
        if(Math.abs(before.messages.left-before.main.left)>3) fail.push('messages shifted from main');
        if(Math.abs(before.composer.left-before.main.left)>3) fail.push('composer shifted from main');
        if(before.scrollWidth>before.innerWidth+3) fail.push('horizontal overflow');
        const toggle=document.querySelector('.mingrx-members-toggle');
        toggle?.click();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const afterMain=rect(main);
        const close=document.querySelector('.mingrx-members-close');
        const drawer=document.querySelector('.members');
        const drawerOpen=document.body.classList.contains('mingrx-members-open');
        if(!close) fail.push('members close button missing');
        if(!drawerOpen) fail.push('members drawer did not open');
        if(Math.abs(afterMain.width-before.main.width)>3) fail.push('members drawer reserved layout width');
        close?.click();
        if(document.body.classList.contains('mingrx-members-open')) fail.push('members close button did not close drawer');
        return {ok:fail.length===0,fail,before,afterMain,drawer:rect(drawer)};
      })();
    `, true);
    if (!result?.ok) throw new Error(`${label}: ${JSON.stringify(result)}`);
    return {label,width:result.before.innerWidth,height:result.before.innerHeight,sidebarWidth:result.before.sidebar.width,dmSidebarWidth:result.before.dmSidebar?.width||null,mainWidth:result.before.main.width,messagesWidth:result.before.messages.width,composerWidth:result.before.composer.width};
  }

  try {
    const results=[];
    results.push(await measure('1280x720',1280,720));
    results.push(await measure('1920x1080',1920,1080));
    results.push(await measure('2048x1152-user-screenshot',2048,1152));
    results.push(await measure('3440x1440',3440,1440));
    results.push(await measure('resize-back-1366x768',1366,768));
    results.push(await measure('resize-forward-2048x1152',2048,1152));
    try { win.destroy(); } catch {}
    finish(0, `Mingrx fluid DM layout Electron test: OK ${JSON.stringify(results)}`);
  } catch (error) {
    fail(error?.message || String(error));
  }
}).catch(error => fail(error?.stack || error?.message || String(error)));
