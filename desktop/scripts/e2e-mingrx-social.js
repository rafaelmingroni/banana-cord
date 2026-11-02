const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

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
  const win = new BrowserWindow({ show:false, width:1280, height:760, webPreferences:{ nodeIntegration:true, contextIsolation:false, sandbox:false } });
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
        friends:[{id:'friend',name:'Gustavo',status:'online',avatar:''}],
        incoming:[{id:'incoming',name:'Marina',status:'away',avatar:''}],
        outgoing:[{id:'outgoing',name:'Paulo',status:'offline',avatar:''}],
        blocked:[{id:'blocked',name:'BlockedUser',status:'offline',avatar:''}]
      };
      els.setup.classList.add('hidden');
      els.app.classList.remove('hidden');
      els.app.classList.add('dm-mode');
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
      return {ok:true,tabs:document.querySelectorAll('.mingrx-social-tab').length,emitted:emitted.map(x=>x.event)};
    })();
  `, true);

  try { win.destroy(); } catch {}
  if (!result?.ok) return fail(result?.why || JSON.stringify(result));
  finish(0, `Mingrx social Electron test: OK ${JSON.stringify(result)}`);
}).catch(error => fail(error?.stack || error?.message || String(error)));
