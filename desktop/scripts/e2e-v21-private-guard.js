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
  console.error('Banana Cord 2.1 private guard E2E failed: hard timeout');
  app.exit(1);
}, 15000);
const finish = (code, message) => {
  clearTimeout(hardTimeout);
  if (message) (code === 0 ? console.log : console.error)(message);
  setTimeout(() => app.exit(code), 50);
};
const fail = message => finish(1, `Banana Cord 2.1 private guard E2E failed: ${message}`);

// Keep the harness alive until its explicit success/failure exit code runs.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:900, height:600, webPreferences:{preload:path.join(__dirname,'..','preload.js'), nodeIntegration:false, contextIsolation:true, sandbox:true } });
  win.webContents.on('console-message', (...args) => { const d=args[1]; const message=typeof d==='object'?d.message:args[2]; if((typeof d==='object' && d.level==='error')||d===3) console.error('renderer error:',message); });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 180));
  const result = await win.webContents.executeJavaScript(`
    (() => {
      const fake={connected:true,on(){return this},off(){return this},emit(){return this}};
      state.user={id:'me',name:'Rafael',status:'online',avatar:''};
      state.socket=fake;
      state.viewMode='dm';
      state.activeDmUserId='peer';
      state.dmConversations=[{user:{id:'peer',name:'Gustavo Pioto',status:'online',avatar:''},lastMessage:{text:'oi',at:Date.now()}}];
      state.dmMessages.set('peer',[{id:'dm1',fromId:'peer',toId:'me',text:'oi',at:Date.now(),reactions:{}}]);
      state.v1=state.v1||{};state.v1.social=state.v1.social||{};state.v1.social.friends=[{id:'peer',name:'Gustavo Pioto',status:'online',avatar:''}];
      els.setup.classList.add('hidden');els.app.classList.remove('hidden');els.app.classList.add('dm-mode');
      renderDmSidebar();
      const before=els.channels.innerHTML;
      const beforeHasPeer=(els.channels.textContent||'').includes('Gustavo Pioto');
      renderChannels();
      const after=els.channels.innerHTML;
      const afterHasPeer=(els.channels.textContent||'').includes('Gustavo Pioto');
      return {beforeHasPeer,afterHasPeer,same:before===after,htmlLength:after.length};
    })();
  `, true);
  if (!result?.beforeHasPeer) return fail(`Private sidebar did not render before guard check: ${JSON.stringify(result)}`);
  if (!result?.afterHasPeer || !result?.same) return fail(`renderChannels erased/changed Private sidebar: ${JSON.stringify(result)}`);
  try { win.destroy(); } catch {}
  finish(0, `Banana Cord 2.1 private sidebar guard Electron test: OK (${result.htmlLength} chars preserved)`);
}).catch(error => fail(error?.stack || error?.message || String(error)));
