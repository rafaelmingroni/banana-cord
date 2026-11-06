const { contextBridge, ipcRenderer } = require('electron');
const invoke = new Set(['banana-updater:check','banana-updater:get-state','banana-updater:get-version',
  'banana-v21:get-settings','banana-v21:set-settings','banana-v21:get-system-languages',
  'clipboard:write','e2ee:decrypt','e2ee:encrypt','e2ee:ensure-keypair','e2ee:status',
  'invite:code-for-server','invite:create-temporary','invite:resolve-short',
  'update:check','update:download','update:get-config','update:get-state','update:install','update:save-config','update:defer',
  'external:open','capture:sources','capture:select','capture:cancel','ptt:configure','rtc:configuration']);
const outgoing = new Set(['banana-call:attention','banana-call:focus','banana-updater:install']);
const incoming = new Set(['host:status','banana-updater:state','banana-v21:system-state','invite:deep-link',
  'shortcut:deafen','shortcut:mute','shortcut:screen','update:state','ptt:state']);
const listeners=new Map();
const bridge={
  invoke(channel,...args){if(!invoke.has(channel))return Promise.reject(new Error('Operação bloqueada.'));return ipcRenderer.invoke(channel,...args);},
  send(channel,...args){if(!outgoing.has(channel))throw new Error('Operação bloqueada.');ipcRenderer.send(channel,...args);},
  on(channel,callback){
    if(!incoming.has(channel)||typeof callback!=='function')throw new Error('Evento bloqueado.');
    const wrapped=(_event,...args)=>callback(null,...args);
    if(!listeners.has(channel))listeners.set(channel,new Map());
    listeners.get(channel).set(callback,wrapped);ipcRenderer.on(channel,wrapped);
  },
  removeListener(channel,callback){const wrapped=listeners.get(channel)?.get(callback);if(wrapped){ipcRenderer.removeListener(channel,wrapped);listeners.get(channel).delete(callback);}},
  removeAllListeners(channel){if(!incoming.has(channel))return;for(const wrapped of listeners.get(channel)?.values()||[])ipcRenderer.removeListener(channel,wrapped);listeners.delete(channel);}
};
contextBridge.exposeInMainWorld('MingrxDesktop',{
  ipcRenderer:bridge,
  shell:{openExternal:url=>bridge.invoke('external:open',url)},
  platform:process.platform
});
