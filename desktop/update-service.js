const { app,BrowserWindow,ipcMain }=require('electron');
const { autoUpdater }=require('electron-updater');
const fs=require('fs'),path=require('path');
const {patchAutoUpdater}=require('./graceful-shutdown');
const {OFFICIAL_UPDATE_OWNER,OFFICIAL_UPDATE_REPO}=require('./src/mingrx-updater-compat');
const repoUrl=`https://github.com/${OFFICIAL_UPDATE_OWNER}/${OFFICIAL_UPDATE_REPO}`;
let config={repoUrl,autoCheck:true,autoDownload:true};
let state={status:'idle',phase:'idle',progress:0,percent:0,version:app.getVersion(),currentVersion:app.getVersion(),error:''};
let timer=null,lastCheck=0;
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
  autoUpdater.autoInstallOnAppQuit=false;
  autoUpdater.autoRunAppAfterInstall=true;
  autoUpdater.allowPrerelease=false;
  autoUpdater.setFeedURL({provider:'github',owner:OFFICIAL_UPDATE_OWNER,repo:OFFICIAL_UPDATE_REPO,private:false});
  return emit();
}
patchAutoUpdater(autoUpdater);
autoUpdater.on('checking-for-update',()=>emit({status:'checking',phase:'checking',message:'Verificando atualizações…',error:''}));
autoUpdater.on('update-not-available',()=>emit({status:'up-to-date',phase:'idle',message:'Mingrx está atualizado.',error:''}));
autoUpdater.on('update-available',info=>emit({status:config.autoDownload?'downloading':'available',phase:config.autoDownload?'downloading':'available',version:info.version,latestVersion:info.version,progress:0,percent:0,error:''}));
autoUpdater.on('download-progress',p=>emit({status:'downloading',phase:'downloading',progress:p.percent,percent:p.percent,bytesPerSecond:p.bytesPerSecond,transferred:p.transferred,total:p.total}));
autoUpdater.on('update-downloaded',info=>emit({status:'downloaded',phase:'ready',version:info.version,latestVersion:info.version,progress:100,percent:100}));
autoUpdater.on('error',error=>emit({status:'error',phase:'error',message:String(error.message||error),error:String(error.message||error)}));
async function checkForUpdates(manual=false){
  if(!app.isPackaged)return emit({status:'dev',phase:'idle',message:'Disponível no aplicativo instalado.'});
  if(['downloading','ready','installing'].includes(state.phase))return state;
  if(!manual && (!config.autoCheck || Date.now()-lastCheck<5*60*1000))return state;
  lastCheck=Date.now();configureUpdater();
  try{await autoUpdater.checkForUpdates();return state;}catch(error){if(manual)throw error;return state;}
}
function scheduleAutomaticUpdateCheck(){clearTimeout(timer);if(config.autoCheck){timer=setTimeout(()=>checkForUpdates(false),6500);timer.unref?.();}}
function install(){if(state.phase!=='ready')return false;emit({phase:'installing',status:'installing'});setTimeout(()=>autoUpdater.quitAndInstall(true,true),350);return true;}
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
ipcMain.handle('banana-updater:get-state',()=>state);
ipcMain.handle('banana-updater:get-version',()=>app.getVersion());
ipcMain.handle('banana-updater:check',async()=>{await checkForUpdates(true);return {ok:true};});
ipcMain.on('banana-updater:install',install);
app.on('browser-window-focus',()=>checkForUpdates(false));
app.whenReady().then(()=>{const periodic=setInterval(()=>checkForUpdates(false),30*60*1000);periodic.unref?.();app.once('before-quit',()=>clearInterval(periodic));});
app.on('before-quit',()=>clearTimeout(timer));
module.exports={loadUpdateConfig,configureUpdater,scheduleAutomaticUpdateCheck,emitUpdateState:emit,checkForUpdates};
