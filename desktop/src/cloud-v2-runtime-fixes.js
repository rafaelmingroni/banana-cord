/* Banana Cord V2 runtime UX fixes.
 * Settings scroll/self-share protection, relogin recovery and lightweight sounds.
 */
(() => {
  if (window.__bananaCloudRuntimeFixes) return;
  window.__bananaCloudRuntimeFixes = true;

  const storageBool = (name, fallback = true) => {
    const value = localStorage.getItem(`banana.${name}`);
    return value == null ? fallback : value === 'true';
  };
  const storageNumber = (name, fallback = 0.55) => {
    const value = Number(localStorage.getItem(`banana.${name}`));
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  };
  const saveBool = (name, value) => localStorage.setItem(`banana.${name}`, String(!!value));
  const saveNumber = (name, value) => localStorage.setItem(`banana.${name}`, String(Math.min(1, Math.max(0, Number(value) || 0))));
  const soundEnabled = name => storageBool('soundMaster', true) && storageBool(name, true);

  function playNotificationTone(kind = 'test', force = false, volumeOverride = null) {
    if (!force && !storageBool('soundMaster', true)) return;
    const volume = volumeOverride == null ? storageNumber('soundVolume', 0.55) : Math.min(1, Math.max(0, Number(volumeOverride) || 0));
    if (volume <= 0) return;
    const presets = {
      join: [[620, 0], [820, 0.09]],
      leave: [[520, 0], [360, 0.09]],
      mute: [[440, 0], [330, 0.07]],
      unmute: [[440, 0], [660, 0.07]],
      deafen: [[380, 0], [280, 0.07]],
      undeafen: [[380, 0], [570, 0.07]],
      dm: [[760, 0], [980, 0.08]],
      test: [[560, 0], [760, 0.08], [930, 0.16]]
    };
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(Math.max(0.001, volume * 0.09), ctx.currentTime);
      master.connect(ctx.destination);
      const notes = presets[kind] || presets.test;
      for (const [frequency, offset] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        const start = ctx.currentTime + offset;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(1, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
        osc.connect(gain).connect(master);
        osc.start(start);
        osc.stop(start + 0.12);
      }
      setTimeout(() => { try { ctx.close(); } catch {} }, 500);
    } catch (error) {
      console.warn('Banana Cord notification sound:', error);
    }
  }

  window.BananaNotificationSounds = { play: playNotificationTone };

  // If a previous Cloud socket bootstrap remained marked as started after logout,
  // a successful second Firebase login could hide the auth gate without rebuilding
  // the app shell. Detect exactly that stale state and reload once. Because Firebase
  // auth uses browserLocalPersistence, the verified account survives the reload and
  // boots normally with a fresh Cloud socket.
  let recoveringRelogin = false;
  window.addEventListener('banana:cloud-ready', () => {
    if (recoveringRelogin) return;
    const appHidden = document.getElementById('app')?.classList.contains('hidden');
    const staleBootstrap = !!window.BananaCloud?.ready && !window.BananaCloudSocket && appHidden;
    if (!staleBootstrap) return;
    recoveringRelogin = true;
    sessionStorage.setItem('banana.cloud.reloginRecovery', '1');
    setTimeout(() => location.reload(), 0);
  });
  if (window.BananaCloudSocket) sessionStorage.removeItem('banana.cloud.reloginRecovery');

  if (typeof updateLocalVideo === 'function') {
    const baseUpdateLocalVideo = updateLocalVideo;

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
      if (placeholder && !placeholder.dataset.originalHtml) placeholder.dataset.originalHtml = placeholder.innerHTML;

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
  }

  try {
    state.ui.joinLeaveSounds = storageBool('soundPeople', state.ui.joinLeaveSounds !== false);
    localStorage.setItem('banana.joinLeaveSounds', String(state.ui.joinLeaveSounds));
  } catch {}
  if (typeof playEventTone === 'function') {
    playEventTone = function playCloudEventTone(type) {
      if (!soundEnabled('soundPeople')) return;
      playNotificationTone(type === 'join' ? 'join' : 'leave');
    };
  }

  if (typeof toggleMute === 'function') {
    const baseToggleMute = toggleMute;
    toggleMute = function toggleMuteWithSound(...args) {
      const before = !!state.voice?.muted;
      const result = baseToggleMute(...args);
      if (state.voice?.channelId && before !== !!state.voice.muted && soundEnabled('soundMute')) playNotificationTone(state.voice.muted ? 'mute' : 'unmute');
      return result;
    };
  }
  if (typeof toggleDeafen === 'function') {
    const baseToggleDeafen = toggleDeafen;
    toggleDeafen = function toggleDeafenWithSound(...args) {
      const before = !!state.voice?.deafened;
      const result = baseToggleDeafen(...args);
      if (state.voice?.channelId && before !== !!state.voice.deafened && soundEnabled('soundDeafen')) playNotificationTone(state.voice.deafened ? 'deafen' : 'undeafen');
      return result;
    };
  }
  if (typeof joinVoice === 'function') {
    const baseJoinVoice = joinVoice;
    joinVoice = async function joinVoiceWithSound(...args) {
      const before = state.voice?.channelId;
      const result = await baseJoinVoice(...args);
      if (!before && state.voice?.channelId && soundEnabled('soundCall')) playNotificationTone('join');
      return result;
    };
  }
  if (typeof leaveVoice === 'function') {
    const baseLeaveVoice = leaveVoice;
    leaveVoice = async function leaveVoiceWithSound(...args) {
      const before = state.voice?.channelId;
      const result = await baseLeaveVoice(...args);
      if (before && !state.voice?.channelId && soundEnabled('soundCall')) playNotificationTone('leave');
      return result;
    };
  }
  els?.hangupBtn?.addEventListener('click', () => {
    const wasConnected = !!state.voice?.channelId;
    if (!wasConnected) return;
    setTimeout(() => {
      if (!state.voice?.channelId && soundEnabled('soundCall')) playNotificationTone('leave');
    }, 80);
  }, true);

  if (typeof toast === 'function') {
    const baseToast = toast;
    toast = function toastWithNotificationSound(message, ...args) {
      if (/^Nova mensagem de\b/i.test(String(message || '')) && soundEnabled('soundDm')) playNotificationTone('dm');
      return baseToast(message, ...args);
    };
  }

  function installNotificationSettingsTab() {
    const navList = document.querySelector('.settings-nav-list');
    const area = document.getElementById('settingsArea');
    if (!navList || !area || document.getElementById('tabNotifications')) return;

    const button = document.createElement('button');
    button.id = 'tabNotifications';
    button.className = 'settings-nav-item';
    button.innerHTML = '<span>🔔</span><b>Notificações</b>';
    const updates = document.getElementById('tabUpdates');
    if (updates) navList.insertBefore(button, updates); else navList.appendChild(button);

    for (const existing of navList.querySelectorAll('.settings-nav-item:not(#tabNotifications)')) existing.addEventListener('click', () => button.classList.remove('active'), true);

    const current = () => ({
      master: storageBool('soundMaster', true),
      call: storageBool('soundCall', true),
      people: storageBool('soundPeople', state.ui?.joinLeaveSounds !== false),
      mute: storageBool('soundMute', true),
      deafen: storageBool('soundDeafen', true),
      dm: storageBool('soundDm', true),
      volume: storageNumber('soundVolume', 0.55)
    });

    const showNotifications = () => {
      try { stopMicTest?.(); stopCameraTest?.(); } catch {}
      document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.toggle('active', el === button));
      const title = document.getElementById('settingsTitle');
      const subtitle = document.getElementById('settingsSubtitle');
      if (title) title.textContent = 'Notificações';
      if (subtitle) subtitle.textContent = 'Sons e alertas do Banana Cord';
      const prefs = current();
      area.innerHTML = `
        <div class="settings-card">
          <div class="settings-card-head compact"><div><span class="settings-kicker">SONS</span><h3>Alertas do aplicativo</h3><p>Escolha quais eventos devem tocar um som. Tudo é processado localmente e é bem leve.</p></div></div>
          <div class="switch-grid">
            <label class="switch-line"><input id="soundMaster" type="checkbox" ${prefs.master ? 'checked' : ''}> Ativar sons do Banana Cord</label>
            <label class="switch-line"><input id="soundCall" type="checkbox" ${prefs.call ? 'checked' : ''}> Entrar / sair da chamada</label>
            <label class="switch-line"><input id="soundPeople" type="checkbox" ${prefs.people ? 'checked' : ''}> Pessoas entrando / saindo</label>
            <label class="switch-line"><input id="soundMute" type="checkbox" ${prefs.mute ? 'checked' : ''}> Mutar / desmutar microfone</label>
            <label class="switch-line"><input id="soundDeafen" type="checkbox" ${prefs.deafen ? 'checked' : ''}> Ensurdecer / voltar a ouvir</label>
            <label class="switch-line"><input id="soundDm" type="checkbox" ${prefs.dm ? 'checked' : ''}> Mensagem privada recebida</label>
          </div>
          <div class="settings-field"><label>Volume dos alertas <span id="soundVolumeLabel">${Math.round(prefs.volume * 100)}%</span></label><input id="soundVolume" type="range" min="0" max="1" step="0.01" value="${prefs.volume}"></div>
          <div class="settings-actions"><button class="secondary" id="testNotificationSound">🔊 Testar som</button><button class="action" id="saveNotificationSounds">Salvar notificações</button></div>
        </div>`;
      const volume = document.getElementById('soundVolume');
      const volumeLabel = document.getElementById('soundVolumeLabel');
      volume?.addEventListener('input', () => { if (volumeLabel) volumeLabel.textContent = `${Math.round(Number(volume.value) * 100)}%`; });
      document.getElementById('testNotificationSound')?.addEventListener('click', () => playNotificationTone('test', true, Number(volume?.value || prefs.volume)));
      document.getElementById('saveNotificationSounds')?.addEventListener('click', () => {
        const master = !!document.getElementById('soundMaster')?.checked;
        const call = !!document.getElementById('soundCall')?.checked;
        const people = !!document.getElementById('soundPeople')?.checked;
        const mute = !!document.getElementById('soundMute')?.checked;
        const deafen = !!document.getElementById('soundDeafen')?.checked;
        const dm = !!document.getElementById('soundDm')?.checked;
        const soundVolume = Number(volume?.value || 0);
        saveBool('soundMaster', master); saveBool('soundCall', call); saveBool('soundPeople', people);
        saveBool('soundMute', mute); saveBool('soundDeafen', deafen); saveBool('soundDm', dm); saveNumber('soundVolume', soundVolume);
        state.ui.joinLeaveSounds = people;
        localStorage.setItem('banana.joinLeaveSounds', String(people));
        toast('Configurações de notificações salvas.');
      });
    };
    button.addEventListener('click', showNotifications);
  }

  // The profile gear registered the original openSettings function before this
  // Cloud runtime patch loaded. Observe the modal so the tab is injected for
  // that direct handler as well as for any future settings entry point.
  const modalBody = document.getElementById('modalBody');
  if (modalBody) {
    let settingsInjectionQueued = false;
    new MutationObserver(() => {
      if (settingsInjectionQueued) return;
      settingsInjectionQueued = true;
      queueMicrotask(() => {
        settingsInjectionQueued = false;
        if (modalBody.querySelector('.settings-shell')) installNotificationSettingsTab();
      });
    }).observe(modalBody, { childList: true, subtree: true });
  }

  if (typeof openSettings === 'function') {
    const baseOpenSettings = openSettings;
    openSettings = function openSettingsWithNotifications(...args) {
      const result = baseOpenSettings(...args);
      queueMicrotask(installNotificationSettingsTab);
      return result;
    };
  }
})();
