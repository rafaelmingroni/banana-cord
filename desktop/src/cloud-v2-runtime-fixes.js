/* Banana Cord V2 runtime UX fixes.
 * Avoid rendering the local screen capture back inside the same app window.
 * Remote peers still receive the original WebRTC video track normally.
 */
(() => {
  if (typeof updateLocalVideo !== 'function') return;

  const baseUpdateLocalVideo = updateLocalVideo;

  // Auto-focus should react to another person's share, not our own static
  // self-share status card. This keeps friends visible while we are sharing.
  if (typeof applyFocusSharing === 'function') {
    applyFocusSharing = function applyFocusSharingCloudSafe() {
      const remoteShare = !![...state.voice.peers.values()].find(p => p.mediaState?.screen);
      const focus = !state.ui.showAllOverride && (
        state.ui.focusSharing || (state.ui.autoFocusShare && remoteShare)
      );
      els.videoGrid.classList.toggle('focus-sharing', focus);
      els.hideCamsBtn.classList.toggle('active', focus);
      els.hideCamsBtn.textContent = focus ? '👁 Mostrar todos' : '👁 Focar tela';
    };
  }

  updateLocalVideo = function updateLocalVideoCloudSafe() {
    const card = document.getElementById('video-local');
    if (!card) return baseUpdateLocalVideo();

    const placeholder = card.querySelector('.video-placeholder');
    if (placeholder && !placeholder.dataset.originalHtml) {
      placeholder.dataset.originalHtml = placeholder.innerHTML;
    }

    if (!state?.voice?.screen) {
      card.classList.remove('self-share-safe');
      if (placeholder?.dataset.originalHtml) placeholder.innerHTML = placeholder.dataset.originalHtml;
      return baseUpdateLocalVideo();
    }

    const video = card.querySelector('video');
    const expand = card.querySelector('.expand-btn');
    const label = card.querySelector('.video-label');

    if (video) {
      try { video.pause(); } catch {}
      video.srcObject = null;
      video.style.display = 'none';
    }

    if (placeholder) {
      placeholder.style.display = 'grid';
      placeholder.innerHTML = `
        <div class="self-share-placeholder">
          <span class="self-share-icon">🖥️</span>
          <b>Você está compartilhando sua tela</b>
          <small>A prévia local foi pausada para evitar efeito espelho, zoom recursivo e uso desnecessário de GPU. Seus amigos continuam recebendo a transmissão normalmente.</small>
        </div>`;
    }

    expand?.classList.add('hidden');
    card.classList.add('is-sharing', 'self-share-safe');
    if (label) label.textContent = 'Você · compartilhando tela';
    if (typeof applyFocusSharing === 'function') applyFocusSharing();
  };
})();
