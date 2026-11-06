const { app,BrowserWindow,ipcMain }=require('electron');
const { autoUpdater }=require('electron-updater');
const fs=require('fs'),path=require('path');
const {fileURLToPath}=require('url');
const {patchAutoUpdater}=require('./graceful-shutdown');
const {OFFICIAL_UPDATE_OWNER,OFFICIAL_UPDATE_REPO}=require('./src/mingrx-updater-compat');
const repoUrl=`https://github.com/${OFFICIAL_UPDATE_OWNER}/${OFFICIAL_UPDATE_REPO}`;
let config={repoUrl,autoCheck:true,autoDownload:true};
let state={status:'idle',phase:'idle',progress:0,percent:0,version:app.getVersion(),currentVersion:app.getVersion(),error:''};
let timer=null,lastCheck=0,autoInstallTimer=null,autoInstallGeneration=0;
let autoInstallDeferred=false,shuttingDown=false;
const configFile=()=>path.join(app.getPath('userData'),'update-config.json');
const windows=()=>BrowserWindow.getAllWindows().filter(w=>!w.isDestroyed());
function emit(patch={}) {
  state={...state,...patch,repoUrl,currentVersion:app.getVersion(),autoCheck:config.autoCheck,autoDownload:config.autoDownload};
  for(const win of windows()) {
    win.webContents.send('update:state',state);win.webContents.send('banana-updater:state',state);
    try{win.setProgressBar(state.phase==='downloading'?state.percent/100:-1);}catch{}
  }
  return state;
}
function loadUpdateConfig(){try{const c=JSON.parse(fs.readFileSync(configFile(),'utf8'));config={repoUrl,autoCheck:c.autoCheck!==false,autoDownload:c.autoDownload!==false};}catch{}return config;}
function configureUpdater(){
  autoUpdater.autoDownload=config.autoDownload;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.autoRunAppAfterInstall=true;
  autoUpdater.allowPrerelease=false;
  autoUpdater.setFeedURL({provider:'github',owner:OFFICIAL_UPDATE_OWNER,repo:OFFICIAL_UPDATE_REPO,private:false});
  return emit();
}
patchAutoUpdater(autoUpdater);
// A downloaded update applies without a button click, including at the auth
// gate. Calls and unsent messages postpone the restart instead of being lost.
const rendererBusyScript=`(() => {
  if(typeof state !== 'object' || !state) return true;
  const voice=state.voice || {};
  const active=stream=>!!stream?.getTracks?.().some(track=>track.readyState!=='ended');
  return !!(voice.channelId || voice.serverId || voice.peers?.size
    || active(voice.localAudio) || active(voice.camera) || active(voice.screen)
    || String(document.getElementById('messageInput')?.value || '').trim()
    || state.v1?.editing
    || document.querySelector('.v218-incoming-call:not(.hidden)'));
})()`;
function cancelAutomaticInstall(){
  clearTimeout(autoInstallTimer);autoInstallTimer=null;autoInstallGeneration++;
}
async function rendererIsBusy(win){
  let timeout;
  try{
    const contents=win.webContents;
    if(contents.isDestroyed())return true;
    const url=new URL(contents.getURL());
    const actual=path.resolve(fileURLToPath(url)),expected=path.join(__dirname,'src','index.html');
    const sameFile=path.sep==='\\' ? actual.toLowerCase()===expected.toLowerCase() : actual===expected;
    if(url.protocol!=='file:' || url.search || url.hash || !sameFile)return true;
    const result=await Promise.race([
      contents.executeJavaScript(rendererBusyScript),
      new Promise(resolve=>{timeout=setTimeout(()=>resolve(true),2000);})
    ]);
    // Only the exact boolean false permits a background restart. An exception,
    // missing renderer or malformed response must never discard active work.
    return result!==false;
  }catch{return true;}
  finally{clearTimeout(timeout);}
}
function scheduleAutomaticInstall(delay=8000){
  cancelAutomaticInstall();
  if(state.phase!=='ready' || autoInstallDeferred || shuttingDown)return;
  const generation=autoInstallGeneration;
  autoInstallTimer=setTimeout(async()=>{
    autoInstallTimer=null;
    const busy=(await Promise.all(windows().map(rendererIsBusy))).some(Boolean);
    if(generation!==autoInstallGeneration || state.phase!=='ready' || autoInstallDeferred || shuttingDown)return;
    if(busy){
      emit({autoInstallPending:true,installDeferred:true,installDeferReason:'activity'});
      scheduleAutomaticInstall(5000);
    }else install();
  },delay);
  autoInstallTimer.unref?.();
}
autoUpdater.on('checking-for-update',()=>emit({status:'checking',phase:'checking',message:'Verificando atualizações…',error:''}));
autoUpdater.on('update-not-available',()=>{cancelAutomaticInstall();emit({status:'up-to-date',phase:'idle',message:'Mingrx está atualizado.',error:'',autoInstallPending:false,installDeferred:false,installDeferReason:''});});
autoUpdater.on('update-available',info=>{cancelAutomaticInstall();autoInstallDeferred=false;emit({status:config.autoDownload?'downloading':'available',phase:config.autoDownload?'downloading':'available',version:info.version,latestVersion:info.version,progress:0,percent:0,error:'',autoInstallPending:false,installDeferred:false,installDeferReason:''});});
autoUpdater.on('download-progress',p=>emit({status:'downloading',phase:'downloading',progress:p.percent,percent:p.percent,bytesPerSecond:p.bytesPerSecond,transferred:p.transferred,total:p.total}));
autoUpdater.on('update-downloaded',info=>{
  emit({status:'downloaded',phase:'ready',version:info.version,latestVersion:info.version,progress:100,percent:100,error:'',autoInstallPending:!autoInstallDeferred,installDeferred:autoInstallDeferred,installDeferReason:autoInstallDeferred?'user':''});
  scheduleAutomaticInstall();
});
autoUpdater.on('error',error=>{cancelAutomaticInstall();emit({status:'error',phase:'error',message:String(error.message||error),error:String(error.message||error),autoInstallPending:false,installDeferred:false,installDeferReason:''});});
async function checkForUpdates(manual=false){
  if(!app.isPackaged)return emit({status:'dev',phase:'idle',message:'Disponível no aplicativo instalado.'});
  if(['downloading','ready','installing'].includes(state.phase))return state;
  if(!manual && (!config.autoCheck || Date.now()-lastCheck<5*60*1000))return state;
  lastCheck=Date.now();configureUpdater();
  try{await autoUpdater.checkForUpdates();return state;}catch(error){if(manual)throw error;return state;}
}
function scheduleAutomaticUpdateCheck(){clearTimeout(timer);if(config.autoCheck){timer=setTimeout(()=>checkForUpdates(false),6500);timer.unref?.();}}
function install(){
  if(state.phase!=='ready' || shuttingDown)return false;
  cancelAutomaticInstall();
  const generation=autoInstallGeneration;
  emit({phase:'installing',status:'installing',autoInstallPending:false,installDeferred:false,installDeferReason:''});
  setTimeout(()=>{
    if(generation===autoInstallGeneration && state.phase==='installing' && !shuttingDown)autoUpdater.quitAndInstall(true,true);
  },350);
  return true;
}
function deferInstall(){
  if(state.phase!=='ready')return false;
  autoInstallDeferred=true;cancelAutomaticInstall();
  emit({autoInstallPending:false,installDeferred:true,installDeferReason:'user'});
  return true;
}
ipcMain.handle('update:get-state',()=>state);
ipcMain.handle('update:get-config',()=>({...config,currentVersion:app.getVersion()}));
ipcMain.handle('update:save-config',(_event,c={})=>{
  if(typeof c!=='object'||c===null)throw new Error('Configuração inválida.');
  if(c.repoUrl && ![repoUrl,'https://github.com/rafaelmingroni/banana-cord'].includes(String(c.repoUrl).replace(/\/$/,'')))throw new Error('Use apenas o repositório oficial.');
  config={repoUrl,autoCheck:c.autoCheck!==false,autoDownload:c.autoDownload!==false};
  fs.mkdirSync(path.dirname(configFile()),{recursive:true});fs.writeFileSync(configFile(),JSON.stringify(config));
  configureUpdater();scheduleAutomaticUpdateCheck();return {...config,currentVersion:app.getVersion()};
});
ipcMain.handle('update:check',()=>checkForUpdates(true));
ipcMain.handle('update:download',async()=>{if(app.isPackaged&&state.status==='available')await autoUpdater.downloadUpdate();return state;});
ipcMain.handle('update:install',install);
ipcMain.handle('update:defer',deferInstall);
ipcMain.handle('banana-updater:get-state',()=>state);
ipcMain.handle('banana-updater:get-version',()=>app.getVersion());
ipcMain.handle('banana-updater:check',async()=>{await checkForUpdates(true);return {ok:true};});
ipcMain.on('banana-updater:install',install);
app.on('browser-window-focus',()=>checkForUpdates(false));
app.whenReady().then(()=>{const periodic=setInterval(()=>checkForUpdates(false),30*60*1000);periodic.unref?.();app.once('before-quit',()=>clearInterval(periodic));});
app.on('before-quit',()=>{shuttingDown=true;clearTimeout(timer);cancelAutomaticInstall();});
module.exports={loadUpdateConfig,configureUpdater,scheduleAutomaticUpdateCheck,emitUpdateState:emit,checkForUpdates};
