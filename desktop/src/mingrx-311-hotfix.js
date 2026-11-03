/* Mingrx 3.1.1 hotfix — server-photo persistence, private navigation and voice/stream cleanup. */
(() => {
  if (window.__mingrx311HotfixLoaded) return;
  window.__mingrx311HotfixLoaded = true;

  const style = document.createElement('style');
  style.textContent = `
    body.mingrx-ui #serverList .server-icon.mingrx311-photo-ready{position:relative!important;overflow:hidden!important;color:transparent!important;background-image:none!important}
    body.mingrx-ui #serverList .mingrx311-server-photo{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center;border-radius:inherit;pointer-events:none;z-index:0}
    body.mingrx-ui #serverList .server-icon.mingrx311-photo-ready>.v1-server-mention,
    body.mingrx-ui #serverList .server-icon.mingrx311-photo-ready>.v1-server-unread{position:absolute;z-index:2}
    body.mingrx-ui #serverList .server-icon.mingrx311-photo-ready>.mingrx-community-initials{display:none!important}

    body.mingrx-ui .v214-private-sidebar .v1-dm-tools{display:flex!important;flex-direction:column!important;grid-template-columns:none!important;gap:7px!important;width:100%!important}
    body.mingrx-ui .v214-private-sidebar .v1-dm-tools>button{width:100%!important;min-height:38px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;text-align:left!important;padding:9px 11px!important;margin:0!important;border-radius:9px!important}
    body.mingrx-ui .v214-private-sidebar .v1-dm-tools>#v207AddFriendBtn{order:3!important;background:var(--mx-accent)!important;border-color:var(--mx-accent)!important;color:#fff!important;box-shadow:none!important}
    body.mingrx-ui .v214-private-sidebar .v1-dm-tools>#v207AddFriendBtn:hover{filter:brightness(1.08)}
  `;
  document.head.appendChild(style);

  const photoTimeoutMs = 7000;
  const missingVoiceSince = new Map();

  function safeIcon(value) {
    const icon = String(value || '').trim();
    if (!icon) return '';
    if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(icon)) return icon;
    try {
      const url = new URL(icon);
      return url.protocol === 'https:' ? url.toString() : '';
    } catch {
      return '';
    }
  }

  function decorateServerPhotos() {
    const list = document.getElementById('serverList');
    if (!list) return;
    for (const button of list.querySelectorAll('.server-icon[data-server-id]')) {
      const server = (state.servers || []).find(item => String(item.id) === String(button.dataset.serverId));
      if (!server) continue;
      const icon = safeIcon(server.icon);
      let img = button.querySelector(':scope > .mingrx311-server-photo');
      if (!icon) {
        img?.remove();
        button.classList.remove('mingrx311-photo-ready');
        continue;
      }
      if (!img) {
        img = document.createElement('img');
        img.className = 'mingrx311-server-photo';
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.addEventListener('error', () => {
          img.remove();
          button.classList.remove('mingrx311-photo-ready');
        });
        button.insertBefore(img, button.firstChild);
      }
      if (img.src !== icon) img.src = icon;
      button.style.backgroundImage = 'none';
      button.classList.add('mingrx311-photo-ready', 'mingrx-community-button-has-photo', 'has-server-image');
    }
  }

  if (typeof renderServers === 'function' && !renderServers.__mingrx311Wrapped) {
    const baseRenderServers = renderServers;
    renderServers = function renderServersMingrx311(...args) {
      const result = baseRenderServers.apply(this, args);
      decorateServerPhotos();
      return result;
    };
    renderServers.__mingrx311Wrapped = true;
  }

  function normalizePrivateActions() {
    if (state.viewMode !== 'dm') return;
    const sidebar = document.querySelector('.v214-private-sidebar,.dm-sidebar');
    const tools = sidebar?.querySelector('.v1-dm-tools');
    const friends = document.getElementById('v1FriendsBtn');
    const message = document.getElementById('newDmBtn');
    const addFriend = document.getElementById('v207AddFriendBtn');
    if (!tools || !friends || !message) return;

    friends.textContent = '👥 Amigos';
    message.textContent = '💬 Mensagem';
    if (addFriend) {
      addFriend.textContent = '＋ Adicionar amigo';
      if (addFriend.parentElement !== tools) tools.appendChild(addFriend);
    }
  }

  if (typeof renderDmSidebar === 'function' && !renderDmSidebar.__mingrx311Wrapped) {
    const baseRenderDmSidebar = renderDmSidebar;
    renderDmSidebar = function renderDmSidebarMingrx311(...args) {
      const result = baseRenderDmSidebar.apply(this, args);
      normalizePrivateActions();
      return result;
    };
    renderDmSidebar.__mingrx311Wrapped = true;
  }

  function dataUrlForBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não consegui preparar a foto da comunidade.'));
      reader.readAsDataURL(blob);
    });
  }

  function waitForServerIcon(serverId, expectedIcon) {
    return new Promise((resolve, reject) => {
      const socket = state.socket;
      if (!socket?.on || !socket?.emit) return reject(new Error('O Mingrx está offline. Tente novamente quando reconectar.'));
      let done = false;
      let timer = null;

      const finish = (error, server) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { socket.off?.('server:updated', onUpdated); } catch {}
        try { socket.off?.('app:error', onError); } catch {}
        if (error) reject(error); else resolve(server);
      };
      const onUpdated = server => {
        if (String(server?.id || '') !== String(serverId)) return;
        if (String(server?.icon || '') !== String(expectedIcon || '')) return;
        finish(null, server);
      };
      const onError = message => finish(new Error(String(message || 'Não consegui salvar a foto da comunidade.')));

      socket.on('server:updated', onUpdated);
      socket.on('app:error', onError);
      timer = setTimeout(() => finish(new Error('A foto não foi confirmada pelo servidor. Tente novamente.')), photoTimeoutMs);
      socket.emit('server:update', { serverId, icon: expectedIcon });
    });
  }

  async function persistServerIcon(server, icon) {
    if (!server?.id) throw new Error('Comunidade inválida.');
    const confirmed = await waitForServerIcon(server.id, icon);
    const current = (state.servers || []).find(item => String(item.id) === String(server.id));
    if (current) current.icon = String(confirmed?.icon || icon || '');
    server.icon = String(confirmed?.icon || icon || '');
    if (state.selectedServer?.id === server.id) state.selectedServer = current || server;
    renderServers();
    return server.icon;
  }

  const previousMedia = window.MingrxMedia;
  if (previousMedia?.compressImage) {
    const updateCommunityPhoto = async (file, targetServer = state.selectedServer) => {
      const server = targetServer;
      if (!server) throw new Error('Selecione uma comunidade.');
      const role = typeof roleFor === 'function' ? roleFor(state.user?.id, server) : 'member';
      const rank = typeof ROLE_RANK !== 'undefined' ? ROLE_RANK : { member:0, moderator:1, admin:2, owner:3 };
      if ((rank[role] || 0) < (rank.admin || 2)) throw new Error('Apenas administradores podem alterar a foto da comunidade.');
      const { blob } = await previousMedia.compressImage(file, { maxDimension:384, maxBytes:260 * 1024 });
      const icon = await dataUrlForBlob(blob);
      if (!safeIcon(icon) || icon.length > 390000) throw new Error('A foto compactada ficou grande demais. Tente outra imagem.');
      return persistServerIcon(server, icon);
    };

    const clearCommunityPhoto = async (targetServer = state.selectedServer) => {
      const server = targetServer;
      if (!server) throw new Error('Selecione uma comunidade.');
      const role = typeof roleFor === 'function' ? roleFor(state.user?.id, server) : 'member';
      const rank = typeof ROLE_RANK !== 'undefined' ? ROLE_RANK : { member:0, moderator:1, admin:2, owner:3 };
      if ((rank[role] || 0) < (rank.admin || 2)) throw new Error('Apenas administradores podem alterar a foto da comunidade.');
      await persistServerIcon(server, '');
      return '';
    };

    window.MingrxMedia = Object.freeze({ ...previousMedia, updateCommunityPhoto, clearCommunityPhoto });
  }

  function updatePhotoCardUi(card, server) {
    if (!card || !server) return;
    const preview = card.querySelector('.mingrx-community-photo-preview');
    const choose = [...card.querySelectorAll('.mingrx-community-photo-actions button')].find(button => !/remover/i.test(button.textContent || ''));
    const remove = [...card.querySelectorAll('.mingrx-community-photo-actions button')].find(button => /remover/i.test(button.textContent || ''));
    const icon = safeIcon(server.icon);
    if (preview) {
      preview.style.backgroundImage = icon ? `url("${icon.replace(/"/g, '%22')}")` : '';
      preview.textContent = icon ? '' : String(server.name || 'M').trim().slice(0, 2).toUpperCase();
    }
    if (choose) choose.textContent = icon ? 'Trocar foto' : 'Escolher foto';
    remove?.classList.toggle('hidden', !icon);
  }

  document.addEventListener('change', event => {
    const input = event.target instanceof Element ? event.target.closest('.mingrx-community-photo-card input[type="file"]') : null;
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const card = input.closest('.mingrx-community-photo-card');
    const server = state.selectedServer;
    const choose = [...(card?.querySelectorAll('.mingrx-community-photo-actions button') || [])].find(button => !/remover/i.test(button.textContent || ''));
    if (choose) { choose.disabled = true; choose.textContent = 'Salvando…'; }
    window.MingrxMedia?.updateCommunityPhoto?.(file, server)
      .then(() => {
        updatePhotoCardUi(card, server);
        toast?.('Foto da comunidade atualizada e confirmada.', 3000);
      })
      .catch(error => {
        updatePhotoCardUi(card, server);
        toast?.(error?.message || 'Não consegui atualizar a foto.', 5000);
      })
      .finally(() => { if (choose) choose.disabled = false; });
  }, true);

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('.mingrx-community-photo-actions button') : null;
    if (!button || !/remover/i.test(button.textContent || '')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const card = button.closest('.mingrx-community-photo-card');
    const server = state.selectedServer;
    button.disabled = true;
    window.MingrxMedia?.clearCommunityPhoto?.(server)
      .then(() => {
        updatePhotoCardUi(card, server);
        toast?.('Foto removida e confirmada.', 2600);
      })
      .catch(error => toast?.(error?.message || 'Não consegui remover a foto.', 4500))
      .finally(() => { button.disabled = false; });
  }, true);

  function exitFullscreenForCard(card) {
    const full = document.fullscreenElement;
    if (!full || !card) return false;
    if (full !== card && !card.contains(full) && !full.contains?.(card)) return false;
    try { Promise.resolve(document.exitFullscreen?.()).catch(() => {}); } catch {}
    return true;
  }

  function handleEndedStreamCard(card) {
    if (!card || card.classList.contains('is-sharing')) return false;
    const wasFullscreen = exitFullscreenForCard(card);
    if (card.classList.contains('mingrx-watching-stream') || window.Mingrx31UX?.watchedCardId === card.id) {
      try { window.Mingrx31UX?.stopWatching?.({ silent:true }); } catch {}
    }
    return wasFullscreen;
  }

  const videoGrid = document.getElementById('videoGrid');
  if (videoGrid) {
    new MutationObserver(records => {
      for (const record of records) {
        const card = record.target instanceof Element ? record.target.closest('.video-card') : null;
        if (card) handleEndedStreamCard(card);
      }
    }).observe(videoGrid, { subtree:true, attributes:true, attributeFilter:['class'] });
  }
  document.addEventListener('fullscreenchange', () => {
    const full = document.fullscreenElement;
    const card = full instanceof Element ? full.closest('.video-card') || (full.classList?.contains('video-card') ? full : null) : null;
    if (card) handleEndedStreamCard(card);
  });

  function canonicalUser(row = {}) {
    const uid = String(row.userId || row.user?.id || '');
    if (uid && uid === String(state.user?.id || '')) return { ...(row.user || {}), ...(state.user || {}), id:uid };
    const member = uid ? state.members?.get?.(uid) : null;
    return member ? { ...(row.user || {}), ...member, id:uid } : (row.user || { id:uid, name:'Amigo', avatar:'' });
  }

  function connectionDead(peer) {
    const pc = peer?.pc;
    const connection = String(pc?.connectionState || '').toLowerCase();
    const ice = String(pc?.iceConnectionState || '').toLowerCase();
    return ['failed','closed','disconnected'].includes(connection) || ['failed','closed','disconnected'].includes(ice);
  }

  function voiceRowKey(serverId, channelId, row = {}) {
    return `${serverId}:${channelId}:${row.socketId || row.userId || row.user?.id || ''}`;
  }

  function reconcileVoicePresence(channelId, { force = false } = {}) {
    const serverId = state.voice?.serverId;
    if (!serverId || !state.voice?.channelId || String(channelId) !== String(state.voice.channelId)) return false;
    const now = Date.now();
    const localUid = String(state.user?.id || '');
    const localSocket = String(state.socket?.id || 'local');
    const existing = [...(state.voicePresence.get(channelId) || [])];
    const peers = [...(state.voice?.peers?.values?.() || [])];
    const peerBySocket = new Map(peers.map(peer => [String(peer.socketId || ''), peer]));
    const peerByUser = new Map(peers.map(peer => [String(peer.user?.id || ''), peer]));
    const transportMap = state.socket?.voiceServerState?.get?.(serverId);
    const next = [];
    const used = new Set();

    for (const row of existing) {
      const uid = String(row.userId || row.user?.id || '');
      const sid = String(row.socketId || '');
      if (uid === localUid || (localSocket && sid === localSocket)) {
        next.push({ ...row, socketId:sid || localSocket, userId:localUid, user:canonicalUser({ ...row, userId:localUid }), mediaState:{ ...(row.mediaState || {}), muted:!!state.voice.muted, camera:!!state.voice.camera, screen:!!state.voice.screen } });
        used.add(`u:${localUid}`);
        continue;
      }

      const peer = peerBySocket.get(sid) || peerByUser.get(uid);
      const transportHas = transportMap instanceof Map ? transportMap.has(sid) : null;
      const definitelyGone = (transportHas === false && !peer) || connectionDead(peer);
      const key = voiceRowKey(serverId, channelId, row);
      if (definitelyGone) {
        const since = missingVoiceSince.get(key) || now;
        missingVoiceSince.set(key, since);
        if (force || now - since >= 2500) continue;
      } else if (!peer && transportHas !== true) {
        const since = missingVoiceSince.get(key) || now;
        missingVoiceSince.set(key, since);
        if (force || now - since >= 6000) continue;
      } else {
        missingVoiceSince.delete(key);
      }

      const merged = peer ? { ...row, socketId:peer.socketId || sid, userId:peer.user?.id || uid, user:canonicalUser({ userId:peer.user?.id || uid, user:peer.user || row.user }), mediaState:{ ...(row.mediaState || {}), ...(peer.mediaState || {}) }, speaking:!!peer.speaking } : { ...row, user:canonicalUser(row) };
      next.push(merged);
      if (merged.socketId) used.add(`s:${merged.socketId}`);
      if (merged.userId) used.add(`u:${merged.userId}`);
    }

    if (localUid && !used.has(`u:${localUid}`)) {
      next.unshift({ socketId:localSocket, userId:localUid, user:canonicalUser({ userId:localUid, user:state.user }), mediaState:{ muted:!!state.voice.muted, camera:!!state.voice.camera, screen:!!state.voice.screen }, speaking:!!state.voice.speaking });
      used.add(`u:${localUid}`);
    }

    for (const peer of peers) {
      const uid = String(peer.user?.id || '');
      const sid = String(peer.socketId || '');
      if (!uid || uid === localUid || used.has(`s:${sid}`) || used.has(`u:${uid}`) || connectionDead(peer)) continue;
      next.push({ socketId:sid, userId:uid, user:canonicalUser({ userId:uid, user:peer.user }), mediaState:{ ...(peer.mediaState || {}) }, speaking:!!peer.speaking });
      used.add(`s:${sid}`);
      used.add(`u:${uid}`);
    }

    const signature = rows => JSON.stringify(rows.map(row => [row.socketId || '', row.userId || row.user?.id || '', row.user?.name || '', !!row.mediaState?.screen, !!row.mediaState?.camera, !!row.mediaState?.muted, !!row.speaking]));
    const changed = signature(existing) !== signature(next);
    if (changed) state.voicePresence.set(channelId, next);
    return changed;
  }

  if (typeof renderVoiceUsers === 'function' && !renderVoiceUsers.__mingrx311Wrapped) {
    const baseRenderVoiceUsers = renderVoiceUsers;
    renderVoiceUsers = function renderVoiceUsersMingrx311(wrap, channelId) {
      reconcileVoicePresence(channelId);
      return baseRenderVoiceUsers.call(this, wrap, channelId);
    };
    renderVoiceUsers.__mingrx311Wrapped = true;
  }

  function scheduleVoiceRepair() {
    setTimeout(() => {
      const channelId = state.voice?.channelId;
      if (!channelId) return;
      const changed = reconcileVoicePresence(channelId);
      if (changed && state.selectedServer?.id === state.voice.serverId && state.viewMode === 'server') {
        try { renderChannels(); } catch {}
      }
    }, 0);
  }

  function attachVoiceGuard(socket) {
    if (!socket?.on || socket.__mingrx311VoiceGuard) return;
    socket.__mingrx311VoiceGuard = true;
    for (const event of ['voice:snapshot','voice:user-left','voice:user-joined','voice:peers','voice:media-state']) socket.on(event, scheduleVoiceRepair);
  }

  if (typeof bindSocket === 'function' && !bindSocket.__mingrx311Wrapped) {
    const baseBindSocket = bindSocket;
    bindSocket = function bindSocketMingrx311(socket) {
      const result = baseBindSocket(socket);
      attachVoiceGuard(socket);
      return result;
    };
    bindSocket.__mingrx311Wrapped = true;
  }
  attachVoiceGuard(state.socket);

  setInterval(() => {
    const channelId = state.voice?.channelId;
    if (!channelId) return;
    const changed = reconcileVoicePresence(channelId);
    if (changed && state.selectedServer?.id === state.voice.serverId && state.viewMode === 'server') {
      try { renderChannels(); } catch {}
    }
  }, 1500);

  queueMicrotask(() => {
    try { decorateServerPhotos(); } catch {}
    try { normalizePrivateActions(); } catch {}
  });

  window.Mingrx311 = Object.freeze({
    safeIcon,
    decorateServerPhotos,
    normalizePrivateActions,
    persistServerIcon,
    waitForServerIcon,
    exitFullscreenForCard,
    handleEndedStreamCard,
    reconcileVoicePresence,
    connectionDead
  });
})();
