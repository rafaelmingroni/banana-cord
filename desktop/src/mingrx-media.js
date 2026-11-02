/* Mingrx media layer — Firebase Storage backed community icons + chat images. */
(() => {
  if (window.__mingrxMediaLoaded) return;
  window.__mingrxMediaLoaded = true;

  const PREFIX = '[[MINGRX_IMAGE_V1:';
  const SUFFIX = ']]';
  const CHAT_MAX_INPUT = 12 * 1024 * 1024;
  const CHAT_MAX_OUTPUT = 1400 * 1024;
  const ICON_MAX_OUTPUT = 420 * 1024;
  let mediaBusy = false;

  function b64urlEncode(value) { return Buffer.from(String(value), 'utf8').toString('base64url'); }
  function b64urlDecode(value) { return Buffer.from(String(value), 'base64url').toString('utf8'); }
  function safeHttps(value) {
    try { const u = new URL(String(value || '')); return u.protocol === 'https:' ? u.toString() : ''; }
    catch { return ''; }
  }
  function encodeMedia(meta = {}) {
    const clean = { u:safeHttps(meta.url), n:String(meta.name || 'imagem').slice(0,96), c:String(meta.caption || '').slice(0,500) };
    if (!clean.u) throw new Error('URL de mídia inválida.');
    const marker = `${PREFIX}${b64urlEncode(JSON.stringify(clean))}${SUFFIX}`;
    if (marker.length > 1900) throw new Error('A legenda da imagem ficou grande demais.');
    return marker;
  }
  function parseMedia(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith(PREFIX) || !raw.endsWith(SUFFIX)) return null;
    try {
      const data = JSON.parse(b64urlDecode(raw.slice(PREFIX.length,-SUFFIX.length)));
      const url = safeHttps(data?.u); if (!url) return null;
      return { url, name:String(data?.n || 'imagem').slice(0,96), caption:String(data?.c || '').slice(0,500) };
    } catch { return null; }
  }

  async function bitmapFor(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file);
    return new Promise((resolve,reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler esta imagem.')); };
      img.src = url;
    });
  }
  function canvasBlob(canvas,type,quality) {
    return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não consegui compactar a imagem.')),type,quality));
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não consegui preparar a foto da comunidade.'));
      reader.readAsDataURL(blob);
    });
  }
  async function compressImage(file,{maxDimension=1920,maxBytes=CHAT_MAX_OUTPUT}={}) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Escolha uma imagem PNG, JPG ou WebP.');
    if (file.size > CHAT_MAX_INPUT) throw new Error('A imagem original deve ter no máximo 12 MB.');
    const source = await bitmapFor(file);
    const sw=Number(source.width||source.naturalWidth||0), sh=Number(source.height||source.naturalHeight||0);
    if (!sw || !sh) throw new Error('Imagem inválida.');
    const ratio=Math.min(1,maxDimension/Math.max(sw,sh));
    const width=Math.max(1,Math.round(sw*ratio)), height=Math.max(1,Math.round(sh*ratio));
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:true}); ctx.drawImage(source,0,0,width,height); source.close?.();
    let blob=null;
    for (const q of [.86,.78,.7,.62,.54]) { blob=await canvasBlob(canvas,'image/webp',q).catch(()=>null); if(blob&&blob.size<=maxBytes)break; }
    if (!blob) blob=await canvasBlob(canvas,'image/jpeg',.72);
    if (blob.size>maxBytes) throw new Error('A imagem continua grande demais após a compactação. Tente recortar ou reduzir a resolução.');
    return {blob,width,height};
  }

  async function uploadBlob(blob,path) {
    const cloudUser=window.BananaCloud?.user;
    const uid=String(cloudUser?.uid||state?.user?.id||'');
    if(!uid||!window.BananaCloudMode)throw new Error('Envio de imagens exige uma conta Mingrx Cloud conectada.');
    const {getStorage,ref:storageRef,uploadBytes,getDownloadURL}=require('firebase/storage');
    const storage=getStorage(), objectRef=storageRef(storage,path);
    const snap=await uploadBytes(objectRef,blob,{contentType:blob.type||'image/webp',cacheControl:'public,max-age=31536000,immutable'});
    return getDownloadURL(snap.ref);
  }
  function objectId(){return crypto.randomUUID().replace(/-/g,'');}
  function cleanPath(value){return String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'unknown';}

  function setAttachBusy(busy){
    mediaBusy=!!busy; const btn=document.getElementById('mingrxAttachBtn'); if(!btn)return;
    btn.disabled=mediaBusy; btn.classList.toggle('mingrx-media-busy',mediaBusy); btn.textContent=mediaBusy?'…':'＋'; btn.title=mediaBusy?'Enviando imagem…':'Anexar imagem';
  }
  async function sendImageFile(file){
    if(mediaBusy||!file)return;
    const isDm=state.viewMode==='dm'&&!!state.activeDmUserId;
    const isChannel=state.viewMode==='server'&&!!state.selectedServer&&state.selectedChannel?.type==='text';
    if(!isDm&&!isChannel)return toast('Abra uma conversa de texto para anexar uma imagem.',3200);
    setAttachBusy(true);
    try{
      const {blob}=await compressImage(file,{maxDimension:1920,maxBytes:CHAT_MAX_OUTPUT});
      const uid=cleanPath(window.BananaCloud?.user?.uid||state.user?.id);
      const scope=isDm?`dm-${cleanPath([state.user?.id,state.activeDmUserId].sort().join('_'))}`:`community-${cleanPath(state.selectedServer.id)}-${cleanPath(state.selectedChannel.id)}`;
      const url=await uploadBlob(blob,`mingrx/chat-media/${uid}/${scope}/${objectId()}.webp`);
      const caption=String(els.messageInput?.value||'').trim().slice(0,500);
      const marker=encodeMedia({url,name:file.name||'imagem',caption});
      if(isDm)state.socket.emit('dm:send',{userId:state.activeDmUserId,text:marker});
      else state.socket.emit('message:send',{serverId:state.selectedServer.id,channelId:state.selectedChannel.id,text:marker});
      if(els.messageInput)els.messageInput.value=''; toast('Imagem enviada.',2200);
    }catch(error){
      const message=String(error?.message||'Não consegui enviar a imagem.');
      toast(message.includes('storage/')?'Não consegui acessar o armazenamento de imagens do Mingrx.':message,5200);
    }finally{setAttachBusy(false);}
  }

  function ensureComposerMediaButton(){
    if(!els?.messageForm||document.getElementById('mingrxAttachBtn'))return;
    const input=document.createElement('input'); input.type='file'; input.accept='image/png,image/jpeg,image/webp'; input.id='mingrxMediaInput'; input.hidden=true;
    const button=document.createElement('button'); button.type='button'; button.id='mingrxAttachBtn'; button.textContent='＋'; button.title='Anexar imagem'; button.setAttribute('aria-label','Anexar imagem');
    button.addEventListener('click',()=>{if(!mediaBusy)input.click();});
    input.addEventListener('change',async()=>{const file=input.files?.[0];input.value='';if(file)await sendImageFile(file);});
    els.messageForm.insertBefore(button,els.messageInput); els.messageForm.appendChild(input);
    els.messageInput?.addEventListener('paste',event=>{
      const item=[...(event.clipboardData?.items||[])].find(row=>String(row.type||'').startsWith('image/')); const file=item?.getAsFile?.();
      if(!file)return; event.preventDefault(); sendImageFile(file);
    });
  }

  function openLightbox(url,alt){
    document.querySelector('.mingrx-image-lightbox')?.remove();
    const box=document.createElement('div');box.className='mingrx-image-lightbox';box.tabIndex=-1;
    const img=document.createElement('img');img.src=url;img.alt=alt||'Imagem anexada';
    const close=document.createElement('button');close.className='mingrx-image-lightbox-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar imagem');
    const remove=()=>{document.removeEventListener('keydown',onKey,true);box.remove();}; const onKey=e=>{if(e.key==='Escape')remove();};
    box.addEventListener('click',e=>{if(e.target===box)remove();});close.onclick=remove;box.append(img,close);document.body.appendChild(box);document.addEventListener('keydown',onKey,true);close.focus();
  }
  function decorateMessageRows(messages=[]){
    const container=els?.messages;if(!container)return;const rows=[...container.querySelectorAll('.message')];
    messages.forEach((message,index)=>{
      const media=parseMedia(message?.text);if(!media)return;let row=null;
      if(message?.id){try{row=container.querySelector(`.message[data-message-id="${CSS.escape(String(message.id))}"]`);}catch{}}
      row||=rows[index];if(!row||row.dataset.mingrxMedia===String(message.id||index))return;
      const text=row.querySelector('.msg-text');if(!text)return;row.dataset.mingrxMedia=String(message.id||index);text.textContent=media.caption||'';text.classList.toggle('hidden',!media.caption);if(media.caption)text.classList.add('mingrx-media-caption');
      const card=document.createElement('div');card.className='mingrx-chat-image-card';const button=document.createElement('button');button.type='button';button.className='mingrx-chat-image-button';button.title='Abrir imagem';
      const img=document.createElement('img');img.src=media.url;img.alt=media.name||'Imagem anexada';img.loading='lazy';img.referrerPolicy='no-referrer';button.appendChild(img);button.onclick=()=>openLightbox(media.url,media.name);
      const meta=document.createElement('div');meta.className='mingrx-chat-image-meta';meta.textContent=media.name||'Imagem';card.append(button,meta);(text.parentElement||row).appendChild(card);
    });
  }
  try{const baseRenderMessages=renderMessages;renderMessages=function renderMessagesMingrxMedia(...args){const result=baseRenderMessages.apply(this,args);const list=state.selectedChannel?(state.messagesByChannel.get(state.selectedChannel.id)||[]):[];decorateMessageRows(list);return result;};}catch{}
  try{const baseRenderDmMessages=renderDmMessages;renderDmMessages=function renderDmMessagesMingrxMedia(...args){const result=baseRenderDmMessages.apply(this,args);const list=state.activeDmUserId?(state.dmMessages.get(state.activeDmUserId)||[]):[];decorateMessageRows(list);return result;};}catch{}

  async function updateCommunityPhoto(file){
    const s=state.selectedServer;if(!s||!can('admin'))throw new Error('Apenas administradores podem alterar a foto da comunidade.');
    const {blob}=await compressImage(file,{maxDimension:512,maxBytes:ICON_MAX_OUTPUT});
    const uid=cleanPath(window.BananaCloud?.user?.uid||state.user?.id);let icon='';
    try{icon=await uploadBlob(blob,`mingrx/community-icons/${uid}/${cleanPath(s.id)}/${objectId()}.webp`);}
    catch(storageError){
      // Community icons can safely fall back to a compact data URL because the server document already supports icon strings.
      icon=await blobToDataUrl(blob);
      if(icon.length>780000)throw storageError;
    }
    s.icon=icon;renderServers();state.socket.emit('server:update',{serverId:s.id,icon});return icon;
  }
  function injectCommunityPhotoCard(){
    const s=state.selectedServer,body=els?.modalBody;if(!s||!body||!can('admin')||body.querySelector('.mingrx-community-photo-card'))return;
    const settings=body.querySelector('.server-settings-grid')||body.querySelector('.v219-server-settings')||body;if(!settings)return;
    const card=document.createElement('div');card.className='mingrx-community-photo-card';const preview=document.createElement('div');preview.className='mingrx-community-photo-preview';
    const updatePreview=()=>{preview.style.backgroundImage=s.icon?`url("${String(s.icon).replace(/"/g,'%22')}")`:'';preview.textContent=s.icon?'':String(s.name||'M').trim().slice(0,2).toUpperCase();};updatePreview();
    const copy=document.createElement('div');copy.className='mingrx-community-photo-copy';const title=document.createElement('b');title.textContent='Foto da comunidade';const note=document.createElement('small');note.textContent='PNG, JPG ou WebP. O Mingrx compacta a imagem automaticamente.';
    const actions=document.createElement('div');actions.className='mingrx-community-photo-actions';const choose=document.createElement('button');choose.type='button';choose.className='primary';choose.textContent=s.icon?'Trocar foto':'Escolher foto';
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.classList.toggle('hidden',!s.icon);const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;
    choose.onclick=()=>input.click();input.onchange=async()=>{const file=input.files?.[0];input.value='';if(!file)return;choose.disabled=true;choose.textContent='Enviando…';try{await updateCommunityPhoto(file);updatePreview();remove.classList.remove('hidden');choose.textContent='Trocar foto';toast('Foto da comunidade atualizada.');}catch(error){toast(error?.message||'Não consegui atualizar a foto.',5000);choose.textContent=s.icon?'Trocar foto':'Escolher foto';}finally{choose.disabled=false;}};
    remove.onclick=()=>{s.icon='';renderServers();state.socket.emit('server:update',{serverId:s.id,icon:''});updatePreview();remove.classList.add('hidden');choose.textContent='Escolher foto';toast('Foto removida.');};
    actions.append(choose,remove,input);copy.append(title,note,actions);card.append(preview,copy);const heading=settings.querySelector('h2');if(heading?.nextSibling)settings.insertBefore(card,heading.nextSibling);else settings.prepend(card);
  }
  document.getElementById('serverSettingsBtn')?.addEventListener('click',()=>{queueMicrotask(injectCommunityPhotoCard);setTimeout(injectCommunityPhotoCard,80);setTimeout(injectCommunityPhotoCard,220);});

  ensureComposerMediaButton();
  window.MingrxMedia=Object.freeze({encodeMedia,parseMedia,compressImage,sendImageFile,injectCommunityPhotoCard});
})();
