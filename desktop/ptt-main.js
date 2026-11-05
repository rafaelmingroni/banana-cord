const {app,ipcMain,powerMonitor}=require('electron');
const {spawn}=require('child_process');
let child=null,configKey='';
const keys={Space:32,ControlLeft:162,ControlRight:163,ShiftLeft:160,ShiftRight:161,AltLeft:164,AltRight:165};
for(let n=0;n<26;n++)keys[`Key${String.fromCharCode(65+n)}`]=65+n;
for(let n=0;n<10;n++)keys[`Digit${n}`]=48+n;
for(let n=1;n<=12;n++)keys[`F${n}`]=111+n;
function stop(){if(child){child.kill();child=null;}configKey='';}
ipcMain.handle('ptt:configure',(event,config={})=>{
  if(typeof config.enabled!=='boolean'||typeof config.code!=='string')throw new Error('Atalho inválido.');
  if(!config.enabled){stop();return{global:process.platform==='win32'};}
  if(process.platform!=='win32')return{global:false};
  const vk=keys[config.code];if(!vk)throw new Error('Essa tecla não suporta push-to-talk global.');
  if(configKey===`${event.sender.id}:${vk}`&&child)return{global:true};
  stop();configKey=`${event.sender.id}:${vk}`;
  // Observe only the explicitly selected PTT key. Never capture typed text.
  const script=`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MingrxKey { [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key); }'; $last=$false; while($true){$held=([MingrxKey]::GetAsyncKeyState(${vk}) -band 0x8000) -ne 0; if($held -ne $last){[Console]::WriteLine($(if($held){'down'}else{'up'}));$last=$held}; Start-Sleep -Milliseconds 20}`;
  child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  const proc=child;
  let pending='';
  proc.stdout.on('data',chunk=>{pending+=chunk.toString();const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines)if(['down','up'].includes(line)&&!event.sender.isDestroyed())event.sender.send('ptt:state',{held:line==='down'});});
  const release=()=>{if(child===proc){child=null;configKey='';}if(!event.sender.isDestroyed())event.sender.send('ptt:state',{held:false});};
  proc.once('error',release);proc.once('exit',release);
  event.sender.once('destroyed',()=>{if(child===proc)stop();});
  return{global:true};
});
app.on('before-quit',stop);

app.whenReady().then(()=>{powerMonitor.on('suspend',stop);powerMonitor.on('lock-screen',stop);});
