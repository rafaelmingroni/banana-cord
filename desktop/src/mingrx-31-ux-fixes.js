/* Mingrx 3.1 — community settings, voice identity and stream watching UX. */
(() => {
  if (window.__mingrx31UxFixesLoaded) return;
  window.__mingrx31UxFixesLoaded = true;

  let watchedCardId = '';

  function repairCommunitySettings() {
    const body = document.getElementById('modalBody');
    const modalCard = document.querySelector('#modal > .modal-card');
    const root = body?.querySelector('.v219-role-settings');
    if (!body || !root) {
      modalCard?.classList.remove('mingrx-server-settings-modal');
      return false;
    }

    modalCard?.classList.add('mingrx-server-settings-modal');

    try { window.MingrxMedia?.injectCommunityPhotoCard?.(); } catch {}

    const card = body.querySelector('.mingrx-community-photo-card');
    const hero = root.querySelector(':scope > .v219-role-hero');
    if (card && hero && (card.parentElement !== root || card.previousElementSibling !== hero)) {
      hero.insertAdjacentElement('afterend', card);
    }

    if (card) {
      card.dataset.mingrx31Placement = 'fixed';
      const choose = [...card.querySelectorAll('button')].find(button => /foto/i.test(button.textContent || '') && !/remover/i.test(button.textContent || ''));
      if (choose) {
        choose.style.display = 'inline-flex';
        choose.style.visibility = 'visible';
      }
    }
    return !!card;
  }

  function scheduleCommunityRepair() {
    for (const delay of [0, 60, 160, 320]) setTimeout(repairCommunitySettings, delay);
  }

  document.getElementById('serverSettingsBtn')?.addEventListener('click', scheduleCommunityRepair, true);

  const modalBody = document.getElementById('modalBody');
  if (modalBody) {
    new MutationObserver(() => {
      if (modalBody.querySelector('.v219-role-settings')) scheduleCommunityRepair();
      else document.querySelector('#modal > .modal-card')?.classList.remove('mingrx-server-settings-modal');
    }).observe(modalBody, { childList:true, subtree:true });
  }

  function stopWatching({ silent = false } = {}) {
    const card = watchedCardId ? document.getElementById(watchedCardId) : document.querySelector('.video-card.mingrx-watching-stream');
    card?.classList.remove('mingrx-watching-stream');
    card?.querySelector('.mingrx-stop-watching')?.remove();
    watchedCardId = '';

    try {
      if (typeof state !== 'undefined') {
        state.ui.focusSharing = false;
        state.ui.showAllOverride = true;
      }
      if (typeof applyFocusSharing === 'function') applyFocusSharing();
    } catch {}

    if (!silent && typeof toast === 'function') toast('Você parou de assistir à transmissão.', 2200);
  }

  function markWatchingCard(card) {
    if (!card || card.id === 'video-local') return false;
    if (watchedCardId && watchedCardId !== card.id) stopWatching({ silent:true });
    watchedCardId = card.id;
    card.classList.add('mingrx-watching-stream');

    let button = card.querySelector('.mingrx-stop-watching');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'mingrx-stop-watching';
      button.textContent = '✕ Parar de assistir';
      button.title = 'Parar de assistir à transmissão';
      button.setAttribute('aria-label', 'Parar de assistir à transmissão');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        stopWatching();
      });
      card.appendChild(button);
    }
    return true;
  }

  function detectWatchTarget() {
    const target = document.querySelector('.video-card.v207-watch-target,.video-card.v208-watch-target')
      || [...document.querySelectorAll('.video-card.is-sharing')].find(card => card.id !== 'video-local');
    if (!target) return false;
    return markWatchingCard(target);
  }

  function scheduleWatchDetection() {
    for (const delay of [280, 520, 1000, 1500]) setTimeout(detectWatchTarget, delay);
  }

  // Older stream buttons stop click bubbling themselves, so capture intent first.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('.v207-watch-stream,.v208-watch-stream,#v207ProfileWatch')) scheduleWatchDetection();
  }, true);

  for (const key of ['BananaWatchBroadcast','BananaWatchStreamV208']) {
    const base = window[key];
    if (typeof base !== 'function' || base.__mingrx31Wrapped) continue;
    const wrapped = async function mingrx31WatchBroadcast(...args) {
      const result = await base.apply(this, args);
      scheduleWatchDetection();
      return result;
    };
    wrapped.__mingrx31Wrapped = true;
    window[key] = wrapped;
  }

  function canonicalVoiceUser(entry = {}) {
    const uid = String(entry.userId || entry.user?.id || '');
    if (!uid) return entry.user || { id:'', name:'Amigo', avatar:'' };
    if (uid === String(state?.user?.id || '')) return { ...(entry.user || {}), ...(state.user || {}), id:uid, name:state.user?.name || entry.user?.name || 'Você' };
    const member = state?.members?.get?.(uid);
    if (member) return { ...(entry.user || {}), ...member, id:uid, name:member.name || entry.user?.name || 'Amigo' };
    return { ...(entry.user || {}), id:uid, name:entry.user?.name || 'Amigo' };
  }

  function repairVoiceList(wrap, channelId) {
    const list = wrap?.querySelector?.('.voice-user-list:last-child');
    if (!list) return;
    const entries = state.voicePresence.get(channelId) || [];
    const rows = [...list.querySelectorAll('.voice-user-row')];
    rows.forEach((row, index) => {
      const entry = entries[index];
      if (!entry) return;
      const user = canonicalVoiceUser(entry);
      entry.user = user;
      entry.userId = user.id || entry.userId;
      const name = row.querySelector('.voice-user-name');
      if (name) name.textContent = user.name || 'Amigo';
      const avatar = row.querySelector('.avatar');
      if (avatar && typeof avatarStyle === 'function') avatarStyle(avatar, user);
      row.title = `${user.name || 'Amigo'}${entry.speaking ? ' está falando' : ''}`;
    });
  }

  if (typeof renderVoiceUsers === 'function' && !renderVoiceUsers.__mingrx31Wrapped) {
    const baseRenderVoiceUsers = renderVoiceUsers;
    renderVoiceUsers = function renderVoiceUsersMingrx31(wrap, channelId) {
      const result = baseRenderVoiceUsers(wrap, channelId);
      repairVoiceList(wrap, channelId);
      return result;
    };
    renderVoiceUsers.__mingrx31Wrapped = true;
  }

  function repairRemoteCard(peer) {
    if (!peer?.socketId) return;
    const card = document.getElementById(`video-${peer.socketId}`);
    if (!card) return;

    const uid = String(peer.user?.id || '');
    const canonical = uid ? canonicalVoiceUser({ userId:uid, user:peer.user }) : peer.user;
    if (canonical) {
      peer.user = canonical;
      const label = card.querySelector('.video-label');
      if (label) label.textContent = `${canonical.name || 'Amigo'}${peer.mediaState?.screen ? ' · compartilhando tela' : peer.mediaState?.muted ? ' · 🔇' : ''}`;
      const avatar = card.querySelector('.avatar-video');
      if (avatar && typeof avatarStyle === 'function') avatarStyle(avatar, canonical);
    }

    const shouldShowVideo = !!(peer.mediaState?.screen || peer.mediaState?.camera);
    if (!shouldShowVideo) {
      const video = card.querySelector('video');
      const placeholder = card.querySelector('.video-placeholder');
      const expand = card.querySelector('.expand-btn');
      if (video) {
        try { video.pause?.(); } catch {}
        video.srcObject = null;
        video.removeAttribute('src');
        video.dataset.sig = '';
        video.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'grid';
      expand?.classList.add('hidden');
      card.classList.remove('is-sharing');
      if (watchedCardId === card.id) stopWatching({ silent:true });
    }
  }

  if (typeof addRemoteCard === 'function' && !addRemoteCard.__mingrx31Wrapped) {
    const baseAddRemoteCard = addRemoteCard;
    addRemoteCard = function addRemoteCardMingrx31(peer) {
      const result = baseAddRemoteCard(peer);
      repairRemoteCard(peer);
      return result;
    };
    addRemoteCard.__mingrx31Wrapped = true;
  }

  if (typeof updatePeerMediaState === 'function' && !updatePeerMediaState.__mingrx31Wrapped) {
    const baseUpdatePeerMediaState = updatePeerMediaState;
    updatePeerMediaState = function updatePeerMediaStateMingrx31(socketId, mediaState) {
      const result = baseUpdatePeerMediaState(socketId, mediaState);
      const peer = state.voice.peers.get(socketId);
      if (peer) repairRemoteCard(peer);
      return result;
    };
    updatePeerMediaState.__mingrx31Wrapped = true;
  }

  const videoGrid = document.getElementById('videoGrid');
  if (videoGrid) {
    new MutationObserver(() => {
      if (!watchedCardId) return;
      const card = document.getElementById(watchedCardId);
      if (!card || !card.classList.contains('is-sharing')) stopWatching({ silent:true });
    }).observe(videoGrid, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  window.Mingrx31UX = Object.freeze({
    repairCommunitySettings,
    markWatchingCard,
    stopWatching,
    canonicalVoiceUser,
    repairVoiceList,
    repairRemoteCard,
    get watchedCardId() { return watchedCardId; }
  });
})();
