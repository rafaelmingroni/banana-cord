const {ipcMain,net}=require('electron');
const path=require('path'),fs=require('fs');
const fallback=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
let cached=null;
function validServers(input){
  if(!Array.isArray(input)||input.length>8)throw new Error('Configuração de relay inválida.');
  return input.map(server=>{
    const urls=Array.isArray(server.urls)?server.urls:[server.urls];
    if(!urls.length||urls.length>8||urls.some(url=>typeof url!=='string'||url.length>512||! /^(stun|turn|turns):[a-z0-9.\-\[\]:]+(?:\?transport=(udp|tcp))?$/i.test(url)))throw new Error('Endereço de relay inválido.');
    if(urls.some(url=>/^turns?:/i.test(url))&&(typeof server.username!=='string'||typeof server.credential!=='string'||server.username.length>1024||server.credential.length>1024))throw new Error('Credenciais de relay inválidas.');
    return{urls, ...(server.username?{username:server.username,credential:server.credential}: {})};
  });
}
ipcMain.handle('rtc:configuration',async (_event,idToken)=>{
  let config={};try{config=JSON.parse(fs.readFileSync(path.join(__dirname,'cloud','rtc-config.json'),'utf8'));}catch{}
  if(!config.credentialsUrl)return{iceServers:fallback,relayAvailable:false};
  const endpoint=new URL(config.credentialsUrl);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||typeof idToken!=='string'||idToken.length>8192)throw new Error('Configuração de relay inválida.');
  // The endpoint must verify the Firebase token and issue short-lived TURN credentials.
  const tokenKey=require('crypto').createHash('sha256').update(idToken).digest('hex');
  if(cached?.key===tokenKey&&cached.expiresAt>Date.now())return cached.result;
  const response=await net.fetch(endpoint.href,{headers:{Authorization:`Bearer ${idToken}`},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('O serviço de relay está indisponível.');
  const text=await response.text();if(text.length>65536)throw new Error('Resposta de relay inválida.');
  const body=JSON.parse(text);const iceServers=validServers(body.iceServers);
  const result={iceServers:[...fallback,...iceServers],relayAvailable:iceServers.some(s=>s.urls.some(u=>/^turns?:/i.test(u)))};
  cached={key:tokenKey,result,expiresAt:Date.now()+Math.min(300,Math.max(0,Number(body.ttl||0)-30))*1000};return result;
});
module.exports={validServers};
