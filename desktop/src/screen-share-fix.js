/* Banana Cord V2.0.4 screen-share compatibility.
 * Retries display capture without system audio when a Windows notebook cannot
 * provide loopback audio, and replaces the old generic failure with a useful
 * error code. The main process compatibility layer always grants a real screen
 * source before any window source.
 */
(() => {
  if (window.__bananaScreenShareFix) return;
  window.__bananaScreenShareFix = true;

  const { ipcRenderer: screenIpc } = require('electron');
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

  async function requestDisplayStream() {
    const video = screenVideoConstraints();
    try {
      // Keep system audio when the machine supports Windows loopback capture.
      return await navigator.mediaDevices.getDisplayMedia({ video, audio: true });
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
