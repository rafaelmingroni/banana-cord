const { ipcMain } = require('electron');
const { fileURLToPath } = require('url');
const path = require('path');
const rendererFile = path.join(__dirname,'src','index.html');
function trusted(event) {
  try {
    if (!event?.senderFrame || event.senderFrame !== event.sender.mainFrame) return false;
    const url = new URL(event.senderFrame.url);
    if(url.protocol!=='file:' || url.search || url.hash)return false;
    const actual=path.resolve(fileURLToPath(url));
    return process.platform==='win32' ? actual.toLowerCase()===rendererFile.toLowerCase() : actual===rendererFile;
  }catch{return false;}
}
function install() {
  if(ipcMain.__mingrxGuarded)return;
  ipcMain.__mingrxGuarded=true;
  const handle=ipcMain.handle.bind(ipcMain), on=ipcMain.on.bind(ipcMain);
  ipcMain.handle=(name,fn)=>handle(name,(event,...args)=>{
    if(!trusted(event))throw new Error('Origem não autorizada.');
    return fn(event,...args);
  });
  ipcMain.on=(name,fn)=>on(name,(event,...args)=>{if(trusted(event))fn(event,...args);});
}
module.exports={trusted,install};
