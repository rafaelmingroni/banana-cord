/* Banana Cord V2.0.4 screen-share compatibility.
 * Retries display capture without system audio when a Windows notebook cannot
 * provide loopback audio, and replaces the old generic failure with a useful
 * error code. The main process compatibility layer always grants a real screen
 * source before any window source.
 */
(() => {
  if (window.__bananaScreenShareFix) return;
  window.__bananaScreenShareFix = true;

  const { ipcRenderer: screenIpc } = window.MingrxDesktop;
  const screenBtn = document.getElementById('screenBtn');

  const isCancel = error => ['AbortError'].includes(String(error?.name || ''));

  function screenVideoConstraints() {
    const q = resolutionFor(state.media.screenQuality);
    return {
      width: { ideal: q.width },
      height: { ideal: q.height },
      frameRate: { ideal: state.media.screenFps, max: state.media.screenFps }
    };
  }

  async function chooseCaptureSource() {
    const sources = await screenIpc.invoke('capture:sources');
    if (!sources.length) throw new Error('Nenhuma tela ou janela disponível.');
    return new Promise(resolve => {
      openModal('<h2>Compartilhar tela ou janela</h2><p>Escolha o que será transmitido. Confira a miniatura antes de iniciar.</p><div id="captureChoices" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px"></div><label><input id="captureSystemAudio" type="checkbox"> Incluir áudio do sistema</label><button id="captureCancel" class="secondary">Cancelar</button>');
      const modal=document.getElementById('modal');
      const finish=value=>{observer.disconnect();closeModal();resolve(value);};
      const observer=new MutationObserver(()=>{if(modal.classList.contains('hidden')){observer.disconnect();screenIpc.invoke('capture:cancel').catch(()=>{});resolve(null);}});
      observer.observe(modal,{attributes:true,attributeFilter:['class']});
      for(const source of sources){
        const button=document.createElement('button');button.type='button';
        const image=document.createElement('img');image.src=source.thumbnail;image.alt='';image.style.width='100%';
        const name=document.createElement('span');name.textContent=source.name;
        button.append(image,name);
        button.onclick=async()=>{
          try{await screenIpc.invoke('capture:select',source.id);finish({audio:document.getElementById('captureSystemAudio').checked});}
          catch(error){toast(error.message);finish(null);}
        };
        document.getElementById('captureChoices').appendChild(button);
      }
      document.getElementById('captureCancel').onclick=()=>{screenIpc.invoke('capture:cancel').catch(()=>{});finish(null);};
    });
  }

  async function requestDisplayStream() {
    const choice = await chooseCaptureSource();
    if (!choice) throw Object.assign(new Error('Captura cancelada.'), {name:'AbortError'});
    const video = screenVideoConstraints();
    try {
      // Keep system audio when the machine supports Windows loopback capture.
      return await navigator.mediaDevices.getDisplayMedia({ video, audio: choice.audio });
    } catch (firstError) {
      if (isCancel(firstError)) throw firstError;
      console.warn('Banana Cord display capture with audio failed; retrying video only:', firstError);
      // Important fallback: screen sharing must still work even if the notebook
      // cannot expose a desktop/system-audio track.
      return navigator.mediaDevices.getDisplayMedia({ video, audio: false });
    }
  }

  async function startScreenCompat() {
    if (!state.voice.channelId || state.voice.screen) return;
    try {
      const stream = await requestDisplayStream();
      const videoTrack = stream?.getVideoTracks?.()[0];
      if (!videoTrack) {
        stream?.getTracks?.().forEach(track => track.stop());
        throw Object.assign(new Error('A captura não retornou uma faixa de vídeo.'), { name: 'NotReadableError' });
      }

      state.voice.screen = stream;
      screenBtn?.classList.add('off');
      videoTrack.contentHint = state.media.streamPreset === 'smooth' ? 'motion' : 'detail';
      videoTrack.onended = stopScreen;
      await setOutgoingVideo(videoTrack);
      await syncSystemAudio();
      screenIpc.invoke('capture:cancel').catch(()=>{});
      updateLocalVideo();
      emitMediaState();

      if (!stream.getAudioTracks().length) {
        toast('Tela compartilhada. Áudio do sistema não está disponível neste computador.', 4200);
      }
    } catch (error) {
      if (isCancel(error)) return;
      console.error('Banana Cord screen share:', error);
      const code = String(error?.name || 'erro');
      toast(`Não consegui compartilhar a tela (${code}).`, 5000);
    }
  }

  async function toggleScreenCompat() {
    if (!state.voice.channelId) return;
    if (state.voice.screen) return stopScreen();
    return startScreenCompat();
  }

  // The original button listener already captured the old function reference.
  // Capture phase lets this compatibility layer handle the click first.
  screenBtn?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleScreenCompat();
  }, true);

  // Replace the old global shortcut listener as well.
  screenIpc.removeAllListeners('shortcut:screen');
  screenIpc.on('shortcut:screen', () => toggleScreenCompat());

  window.BananaScreenShareFix = {
    requestDisplayStream,
    startScreenCompat,
    toggleScreenCompat
  };
})();
