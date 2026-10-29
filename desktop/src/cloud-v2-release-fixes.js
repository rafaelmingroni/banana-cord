/* Banana Cord V2 official release fixes.
 * Handles button-bound notification sounds that were attached before the
 * Cloud notification wrapper replaced toggleMute/toggleDeafen.
 */
(() => {
  if (window.__bananaV2ReleaseFixes) return;
  window.__bananaV2ReleaseFixes = true;

  const enabled = name => {
    const master = localStorage.getItem('banana.soundMaster');
    const specific = localStorage.getItem(`banana.${name}`);
    return master !== 'false' && specific !== 'false';
  };

  function bindStateSound(button, key, pref, onKind, offKind) {
    if (!button || button.dataset.releaseSoundBound === '1') return;
    button.dataset.releaseSoundBound = '1';
    button.addEventListener('click', () => {
      const wasConnected = !!state?.voice?.channelId;
      const before = !!state?.voice?.[key];
      setTimeout(() => {
        const after = !!state?.voice?.[key];
        if (!wasConnected || before === after || !enabled(pref)) return;
        window.BananaNotificationSounds?.play?.(after ? onKind : offKind);
      }, 0);
    }, true);
  }

  bindStateSound(document.getElementById('muteBtn'), 'muted', 'soundMute', 'mute', 'unmute');
  bindStateSound(document.getElementById('deafenBtn'), 'deafened', 'soundDeafen', 'deafen', 'undeafen');
})();
