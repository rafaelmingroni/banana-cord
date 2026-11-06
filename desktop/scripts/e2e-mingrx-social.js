const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.on('window-all-closed',()=>{});

ipcMain.handle('update:get-config', async () => ({ repoUrl:'', autoCheck:true, autoDownload:true, currentVersion:'2.1.0' }));
ipcMain.handle('update:get-state', async () => ({ status:'idle', progress:0, message:'' }));
ipcMain.handle('clipboard:write', async () => true);
ipcMain.handle('banana-updater:get-state', async () => ({ phase:'idle', version:'2.1.0', percent:0 }));
ipcMain.handle('banana-updater:get-version', async () => '2.1.0');
ipcMain.handle('banana-updater:check', async () => ({ ok:true }));
ipcMain.handle('banana-v21:get-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false }));
ipcMain.handle('banana-v21:set-settings', async () => ({ idleSeconds:0,idleState:'active',activity:null,settings:{shareActivity:true,autoAwayMinutes:5,startup:{enabled:false}},startupLaunch:false }));
ipcMain.handle('banana-v21:get-system-languages', async () => ['pt-BR']);

const hardTimeout = setTimeout(() => {
  console.error('Mingrx social E2E failed: hard timeout');
  app.exit(1);
}, 22000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function finish(code, message) {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 40);
}
const fail = message => finish(1, `Mingrx social E2E failed: ${message}`);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1280, height:760, webPreferences:{preload:path.join(__dirname,'..','preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true,backgroundThrottling:false } });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await sleep(260);

  const result = await win.webContents.executeJavaScript(`
    (async()=>{
      const emitted=[];
      const fake={
        connected:true,
        on(){return this},off(){return this},
        emit(event,payload,ack){
          emitted.push({event,payload});
          if(event==='friend:search') ack?.({ok:true,users:[{id:'found',name:'FoundUser',status:'online',avatar:''}]});
          else ack?.({ok:true});
          return this;
        }
      };
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.socket=fake;
      state.viewMode='dm';
      state.activeDmUserId=null;
      state.selectedServer=null;
      state.selectedChannel=null;
      state.dmConversations=[];
      state.v1=state.v1||{};
      state.v1.social={
        friends:[{id:'friend-same-prefix-0000000001',name:'Gustavo',status:'online',avatar:''},{id:'friend-same-prefix-0000000002',name:'Gustavo',status:'offline',avatar:''}],
        incoming:[{id:'incoming',name:'Marina',status:'away',avatar:''}],
        outgoing:[{id:'outgoing',name:'Paulo',status:'offline',avatar:''}],
        blocked:[{id:'blocked',name:'BlockedUser',status:'offline',avatar:''}]
      };
      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      els.app.classList.add('dm-mode');
      document.getElementById('cloudGate')?.classList.add('hidden');
      window.MingrxThemes?.apply('midnight');
      renderDmSidebar();
      await new Promise(r=>setTimeout(r,50));
      const friends=document.getElementById('v1FriendsBtn');
      if(!friends) return {ok:false,why:'friends trigger missing'};
      friends.click();
      await new Promise(r=>setTimeout(r,40));
      const hub=document.querySelector('.mingrx-social-hub');
      if(!hub) return {ok:false,why:'Mingrx social hub did not open'};
      if(document.querySelector('.v1-social-section')) return {ok:false,why:'legacy social sections still rendered'};
      const friendRow=[...document.querySelectorAll('.mingrx-social-row')].find(row=>row.textContent.includes('Gustavo'));
      if(!friendRow) return {ok:false,why:'friend row missing'};
      const hit=friendRow.getBoundingClientRect();
      if(!friendRow.contains(document.elementFromPoint(hit.left+20,hit.top+20)))return {ok:false,why:'friend list is obscured by an overlay'};
      const rows=[...hub.querySelectorAll('.mingrx-social-row')];
      if(rows.length!==2||rows[0].querySelector('code')?.textContent===rows[1].querySelector('code')?.textContent)return {ok:false,why:'same-name accounts need distinct visible IDs'};
      const first=rows[0].getBoundingClientRect(),second=rows[1].getBoundingClientRect();
      if(first.height>95||second.top-first.bottom>8)return {ok:false,why:'friend rows stretch or have excessive spacing'};
      const tabs=[...hub.querySelectorAll('.mingrx-social-tab')];
      if(tabs.some(tab=>Math.abs(tab.getBoundingClientRect().top-tabs[0].getBoundingClientRect().top)>2))return {ok:false,why:'friend tabs should form one compact horizontal row'};
      const addBounds=hub.querySelector('.mingrx-social-add-button').getBoundingClientRect();
      if(addBounds.width>200||addBounds.right>hub.getBoundingClientRect().right-15)return {ok:false,why:'Add friend button must fit beside the heading'};
      if(!rows.every(row=>row.querySelector('[data-mx-copy-id]')))return {ok:false,why:'account IDs cannot be copied'};
      document.querySelector('[data-mx-tab="incoming"]')?.click();
      if(!document.getElementById('mingrxSocialBody')?.textContent.includes('Marina')) return {ok:false,why:'incoming tab did not render'};
      document.querySelector('[data-mx-tab="add"]')?.click();
      const input=document.getElementById('mingrxFriendQuery');
      const search=document.getElementById('mingrxFriendSearch');
      if(!input||!search) return {ok:false,why:'add friend search missing'};
      input.value='Found';
      search.click();
      await new Promise(r=>setTimeout(r,40));
      const found=[...document.querySelectorAll('.mingrx-social-row')].find(row=>row.textContent.includes('FoundUser'));
      if(!found) return {ok:false,why:'search result did not render'};
      found.querySelector('[data-mx-add]')?.click();
      await new Promise(r=>setTimeout(r,20));
      const searched=emitted.some(row=>row.event==='friend:search'&&row.payload?.query==='Found');
      const requested=emitted.some(row=>row.event==='friend:request'&&row.payload?.userId==='found');
      if(!searched) return {ok:false,why:'friend search event not emitted'};
      if(!requested) return {ok:false,why:'friend request event not emitted'};
      closeModal();state.v1.social={friends:[],incoming:[],outgoing:[],blocked:[]};showDmHome();
      await new Promise(r=>setTimeout(r,60));
      const welcome=document.querySelector('.mingrx-private-welcome');
      if(!welcome||parseFloat(getComputedStyle(welcome.querySelector('h2')).fontSize)>22||!document.getElementById('v214HomeFriend'))return {ok:false,why:'new-account Private welcome must be compact and useful'};
      if(document.querySelector('[data-mingrx312-nav="add"]')||document.querySelector('.v214-private-intro')?.getClientRects().length)return {ok:false,why:'redundant Private controls remain visible'};
      document.getElementById('v214HomeFriend').click();
      if(!document.getElementById('mingrxFriendQuery'))return {ok:false,why:'new-account welcome cannot find friends'};
      return {ok:true,tabs:document.querySelectorAll('.mingrx-social-tab').length,emitted:emitted.map(x=>x.event)};
    })();
  `, true);

  if(result?.ok&&process.env.MINGRX_VISUAL_PREVIEW){
    win.show();
    await win.webContents.executeJavaScript(`state.v1.social.friends=[{id:'vLM3aPc8jN6wRxQ4tZ7yE2bHkS01',name:'Gustavo',status:'online',avatar:'',customStatus:'Bora jogar?'},{id:'aqH8wC2mL9eV5fT7bR4xK1pSgN06',name:'Gustavo',status:'away',avatar:''},{id:'zD7kP3yL8uW2eA5qC6mV9tBfR014',name:'Marina',status:'offline',avatar:''}];window.MingrxOpenFriends('friends');`);
    await sleep(350);win.webContents.invalidate();await sleep(100);require('fs').writeFileSync('/tmp/mingrx-friends-preview.png',(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript('closeModal();state.v1.social={friends:[],incoming:[],outgoing:[],blocked:[]};showDmHome();');
    await sleep(250);win.webContents.invalidate();await sleep(100);require('fs').writeFileSync('/tmp/mingrx-private-preview.png',(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("window.MingrxThemes.apply('pearl');window.MingrxOpenFriends('friends');");
    await sleep(350);win.webContents.invalidate();await sleep(100);require('fs').writeFileSync('/tmp/mingrx-friends-light-preview.png',(await win.webContents.capturePage()).toPNG());
  }
  try { win.destroy(); } catch {}
  if (!result?.ok) return fail(result?.why || JSON.stringify(result));
  finish(0, `Mingrx social Electron test: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));
