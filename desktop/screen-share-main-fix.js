const { app, session, desktopCapturer, ipcMain, webContents }=require('electron');
const {trusted}=require('./ipc-security');
const choices=new Map();
ipcMain.handle('capture:sources',async event=>{
  const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:320,height:180},fetchWindowIcons:true});
  const available=new Map(sources.map(s=>[s.id,s]));
  choices.set(event.sender.id,{available,selected:'',expiresAt:Date.now()+60000});
  return sources.map(s=>({id:s.id,name:s.name,thumbnail:s.thumbnail.toDataURL(),displayId:s.display_id||''}));
});
ipcMain.handle('capture:select',(event,id)=>{
  const state=choices.get(event.sender.id);
  if(!state||state.expiresAt<Date.now()||typeof id!=='string'||!state.available.has(id))throw new Error('Selecione uma tela ou janela novamente.');
  state.selected=id;return true;
});
ipcMain.handle('capture:cancel',event=>{choices.delete(event.sender.id);return true;});
app.on('web-contents-created',(_event,wc)=>wc.once('destroyed',()=>choices.delete(wc.id)));
app.whenReady().then(()=>{
  session.defaultSession.setDisplayMediaRequestHandler((request,callback)=>{
    const wc=request.frame?webContents.fromFrame(request.frame):null;
    if(!wc||!trusted({sender:wc,senderFrame:request.frame}))return callback({});
    const state=choices.get(wc.id);
    if(!state||state.expiresAt<Date.now()||!state.selected)return callback({});
    const video=state.available.get(state.selected);
    if(!video)return callback({});
    const streams={video};
    if(request.audioRequested&&process.platform==='win32')streams.audio='loopback';
    callback(streams);
  },{useSystemPicker:false});
});
