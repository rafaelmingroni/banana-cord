const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {app, BrowserWindow, ipcMain} = require('electron');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mingrx-members-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
app.on('window-all-closed', () => {});
let copied = '';
const version = require('../package.json').version;
for (const name of ['update:get-state','banana-updater:get-state']) ipcMain.handle(name, () => ({phase:'idle', status:'idle'}));
ipcMain.handle('update:get-config', () => ({currentVersion:version,autoCheck:true,autoDownload:true}));
ipcMain.handle('banana-updater:get-version', () => version);
ipcMain.handle('banana-updater:check', () => ({ok:true}));
ipcMain.handle('clipboard:write', (_event, text) => {copied=text;return true;});
const settings = {settings:{shareActivity:false,startup:{enabled:false}}, idleState:'active'};
ipcMain.handle('banana-v21:get-settings', () => settings);
ipcMain.handle('banana-v21:set-settings', () => settings);
ipcMain.handle('banana-v21:get-system-languages', () => ['pt-BR']);
ipcMain.handle('ptt:configure', () => ({ok:true}));
let win;
let done=false;
const timeout=setTimeout(()=>finish(1,'Members/invites E2E: timeout'),30000);
function finish(code,message){
  if(done)return;done=true;clearTimeout(timeout);
  (code?console.error:console.log)(message);
  try{win?.destroy();fs.rmSync(profile,{recursive:true,force:true});}catch{}
  app.exit(code);
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
const js=code=>win.webContents.executeJavaScript(code,true);
async function seed(){
  await js(`(() => {
    const server={id:'member-test',name:'Community',ownerId:'me',inviteCode:'ABCD2345',memberRoles:{me:'owner'},channels:[{id:'general',name:'geral',type:'text'}],categories:[]};
    state.user={id:'me',name:'Test'};state.servers=[server];
    state.socket={on(){return this},off(){return this},emit(event,payload,ack){if(event==='invite:create-temporary')ack?.({ok:true,code:'EFGH6789',expiresAt:Date.now()+60000});else ack?.({ok:true});return this}};
    document.getElementById('cloudGate')?.classList.add('hidden');
    els.app.classList.remove('hidden');els.setup.classList.add('hidden');
    selectServer(server.id);
    state.members=new Map([['me',{id:'me',name:'Test',status:'online',role:'owner'}]]);renderMembers();
  })()`);
  await pause();
}
async function state(){return js(`(() => {
  const app=document.getElementById('app'), panel=document.querySelector('.members'),main=document.querySelector('.main'),toggle=document.querySelector('.mingrx-members-toggle');
  const p=panel.getBoundingClientRect(),m=main.getBoundingClientRect();
  return {open:document.body.classList.contains('mingrx-members-open'),aria:panel.getAttribute('aria-hidden'),pressed:toggle.getAttribute('aria-pressed'),visible:p.width>0&&getComputedStyle(panel).opacity==='1',docked:p.left>=m.right-1,mainWidth:m.width,preference:localStorage.getItem('mingrx.membersVisible.v1')};
})()`);}
app.whenReady().then(async()=>{
  win=new BrowserWindow({show:false,width:1366,height:850,webPreferences:{preload:path.join(root,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await win.loadFile(path.join(root,'src/index.html'));await seed();
  const initial=await state();
  assert(initial.open&&initial.visible&&initial.docked&&initial.aria==='false'&&initial.pressed==='true',JSON.stringify(initial));
  for(const width of [980,1024,1366]){
    win.setBounds({width,height:850});await pause();
    const layout=await state();
    assert(layout.docked&&layout.mainWidth>350,`members overlap chat at ${width}: ${JSON.stringify(layout)}`);
    assert(await js('document.documentElement.scrollWidth<=innerWidth+2'),`horizontal overflow at ${width}`);
  }
  await js("document.getElementById('messageInput').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  assert((await state()).open,'clicking chat must not dismiss the docked member list');
  await js("document.querySelector('.mingrx-members-toggle').click()");await pause();
  const hidden=await state();
  assert(!hidden.open&&hidden.preference==='false'&&hidden.mainWidth>initial.mainWidth,'hide must expand chat and persist preference');
  await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await seed();
  assert.equal((await state()).open,false,'hidden preference must survive reload');
  await js("document.querySelector('.mingrx-members-toggle').click()");await pause();
  assert.equal((await state()).open,true);
  assert.equal((await state()).preference,'true');
  await js("document.getElementById('inviteBtn').click()");await pause();
  await js("document.getElementById('mxInviteCopyLink').click()");await pause();
  assert.equal(copied,'https://mingrx.site/?invite=ABCD-2345');
  await js("document.getElementById('mxInviteTemporary').click()");await pause();
  await js("document.getElementById('mxInviteTempLinkCopy').click()");await pause();
  assert.equal(copied,'https://mingrx.site/?invite=EFGH-6789');
  await js("closeModal();showDmHome()");await pause();
  assert(await js("!document.querySelector('.members').getClientRects().length"),'private messages must not show community members');
  await js("selectServer('member-test')");await pause();
  assert((await state()).open,'returning to a community must preserve the visible preference');
  await js("document.querySelector('.mingrx-members-close').click()");await pause();
  assert.equal((await state()).preference,'false','close button must persist hidden preference');
  finish(0,'Members default visible, docked layout, persisted preference and permanent/temporary HTTPS invites: OK');
}).catch(error=>finish(1,error.stack||String(error)));
