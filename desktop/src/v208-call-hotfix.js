/* Banana Cord V2.0.8 — restore stable voice transport and keep identity/stream UX safe. */
(() => {
  if (window.__bananaV208CallHotfix) return;
  window.__bananaV208CallHotfix = true;

  const directoryByServer = new Map();

  const uidOf = (socketId, row = {}) => String(row.userId || row.user?.id || socketId || '');
  const joinedAt = row => Number(row?.joinedAt || 0) || 0;

  function dedupeTree(serverId, tree = {}, socket) {
    const localUid = String(socket?.user?.uid || state.user?.id || '');
    const bestByUid = new Map();

    for (const [channelId, sessions] of Object.entries(tree || {})) {
      for (const [socketId, raw] of Object.entries(sessions || {})) {
        const uid = uidOf(socketId, raw);
        if (!uid) continue;

        // A stale session from this same account must never render as another person.
        // The current socket is the only valid local session.
        if (uid === localUid && socketId !== socket?.id) continue;

        const row = {
          ...raw,
          userId: uid,
          user: { ...(raw.user || {}), id: uid, name: raw.user?.name || 'Amigo' },
          socketId,
          channelId
        };
        const prev = bestByUid.get(uid);
        const newer = joinedAt(row) > joinedAt(prev);
        const tie = joinedAt(row) === joinedAt(prev) && String(socketId) > String(prev?.socketId || '');
        if (!prev || newer || tie) bestByUid.set(uid, row);
      }
    }

    const clean = {};
    const bySocket = new Map();
    for (const row of bestByUid.values()) {
      clean[row.channelId] ||= {};
      const { socketId, channelId, ...stored } = row;
      clean[channelId][socketId] = stored;
      bySocket.set(socketId, row);
    }
    directoryByServer.set(serverId, { byUid: bestByUid, bySocket });
    return clean;
  }

  function findSocket(socketId) {
    for (const [serverId, dir] of directoryByServer) {
      const row = dir.bySocket.get(socketId);
      if (row) return { serverId, row };
    }
    return null;
  }

  function currentVoiceDirectory(socket) {
    const serverId = socket?.voice?.serverId || state.voice?.serverId || '';
    return serverId ? directoryByServer.get(serverId) || null : null;
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV208Patched) return false;
    if (typeof socket.receive !== 'function' || typeof socket.processVoiceServer !== 'function') return false;

    socket.__bananaV208Patched = true;

    // V2.0.6/2.0.7 used standalone Firebase Database imports around a Realtime Database
    // instance created inside the Cloud browser bundle. Mixing those SDK instances can
    // produce `childPathObj.split is not a function` and prevent users from joining the
    // same room. Mark those transport wrappers as already handled before their attach
    // hooks run. V2.0.8 keeps the original bundled Cloud transport.
    socket.__bananaV206CallUpdatePatched = true;
    socket.__bananaV207VoiceStreamPatched = true;

    const baseProcessVoiceServer = socket.processVoiceServer.bind(socket);
    socket.processVoiceServer = function processVoiceServerV208(serverId, tree) {
      return baseProcessVoiceServer(serverId, dedupeTree(serverId, tree, this));
    };

    const baseReceive = socket.receive.bind(socket);
    socket.receive = function receiveV208(event, payload = {}) {
      const localUid = String(this.user?.uid || state.user?.id || '');
      const roomDir = currentVoiceDirectory(this);

      if (event === 'voice:peers' && Array.isArray(payload.peers)) {
        const best = new Map();
        for (const raw of payload.peers) {
          const auth = roomDir?.bySocket.get(raw?.socketId) || null;
          const uid = String(auth?.userId || raw?.user?.id || raw?.userId || raw?.socketId || '');
          if (!uid || uid === localUid || raw?.socketId === this.id) continue;

          const authoritative = roomDir?.byUid.get(uid) || null;
          if (authoritative && authoritative.socketId !== raw.socketId) continue;

          const peer = auth
            ? { ...raw, userId: auth.userId, user: auth.user, mediaState: auth.mediaState || raw.mediaState || {} }
            : raw;
          best.set(uid, peer);
        }
        payload = { ...payload, peers: [...best.values()] };
      }

      if (event === 'voice:user-joined') {
        const auth = roomDir?.bySocket.get(payload.socketId) || null;
        const uid = String(auth?.userId || payload.user?.id || '');
        if (!uid || uid === localUid || payload.socketId === this.id) return;
        const authoritative = roomDir?.byUid.get(uid) || null;
        if (authoritative && authoritative.socketId !== payload.socketId) return;

        for (const peer of [...state.voice.peers.values()]) {
          if (peer.socketId !== payload.socketId && peer.user?.id === uid) {
            try { removePeer(peer.socketId); } catch {}
          }
        }
        if (auth) payload = { ...payload, user: auth.user, mediaState: auth.mediaState || payload.mediaState || {} };
      }

      if (event === 'webrtc:signal') {
        const auth = roomDir?.bySocket.get(payload.fromSocketId) || null;
        const uid = String(auth?.userId || payload.fromUser?.id || '');
        if (payload.fromSocketId === this.id || (uid && uid === localUid)) return;
        const authoritative = uid ? roomDir?.byUid.get(uid) || null : null;
        if (authoritative && authoritative.socketId !== payload.fromSocketId) return;
        if (auth) payload = { ...payload, fromUser: auth.user };
      }

      if ((event === 'voice:media-state-global' || event === 'voice:speaking-global') && payload.socketId) {
        const location = findSocket(payload.socketId);
        const auth = location?.row || null;
        const uid = String(auth?.userId || payload.userId || '');
        const dir = location ? directoryByServer.get(location.serverId) : null;
        const authoritative = uid ? dir?.byUid.get(uid) || null : null;
        if (authoritative && authoritative.socketId !== payload.socketId) return;
        if (auth) payload = { ...payload, userId: auth.userId, channelId: auth.channelId };
      }

      return baseReceive(event, payload);
    };

    return true;
  }

  window.BananaV208PatchCallSocket = patchSocket;

  // The V2.0.8 hook runs before the older attach wrappers so their Firebase transport
  // monkey patches see the guard flags above and do not install.
  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV208(socket, user) {
      patchSocket(socket);
      return previousAttachSocket(socket, user);
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);

  function syncLocalIdentity() {
    const card = document.getElementById('video-local');
    if (!card) return;
    const user = state.user || { name: 'Usuário', avatar: '' };
    const avatar = card.querySelector('.avatar-video');
    if (avatar) avatarStyle(avatar, user);
    const label = card.querySelector('.video-label');
    if (label) {
      const name = user.name || 'Usuário';
      label.textContent = state.voice.screen
        ? `${name} · compartilhando tela`
        : state.voice.muted
          ? `${name} · 🔇`
          : name;
    }
  }

  if (typeof addLocalCard === 'function') {
    const previousAddLocalCard = addLocalCard;
    addLocalCard = function addLocalCardV208() {
      const result = previousAddLocalCard();
      syncLocalIdentity();
      return result;
    };
  }
  if (typeof updateLocalVideo === 'function') {
    const previousUpdateLocalVideo = updateLocalVideo;
    updateLocalVideo = function updateLocalVideoV208() {
      const result = previousUpdateLocalVideo();
      syncLocalIdentity();
      return result;
    };
  }

  async function watchStream(serverId, channelId, userId) {
    const server = state.servers.find(s => s.id === serverId);
    const channel = server?.channels?.find(c => c.id === channelId && c.type === 'voice');
    if (!server || !channel) return toast('Essa transmissão não está mais disponível.');

    if (state.selectedServer?.id !== serverId) selectServer(serverId);
    selectChannel(channelId);

    const alreadyThere = state.voice.serverId === serverId && state.voice.channelId === channelId;
    if (!alreadyThere) {
      if (state.voice.channelId && !confirm('Você está em outra call. Trocar para esta transmissão?')) return;
      await joinVoice(channel);
    }

    state.ui.showAllOverride = false;
    state.ui.focusSharing = true;
    applyFocusSharing();

    const focus = () => {
      const peer = [...state.voice.peers.values()].find(p => p.user?.id === userId && p.mediaState?.screen);
      const card = peer ? document.getElementById(`video-${peer.socketId}`) : null;
      if (!card) return;
      card.classList.add('v208-watch-target');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('v208-watch-target'), 1600);
    };
    setTimeout(focus, 250);
    setTimeout(focus, 900);
  }
  window.BananaWatchStreamV208 = watchStream;

  if (typeof renderVoiceUsers === 'function') {
    const previousRenderVoiceUsers = renderVoiceUsers;
    renderVoiceUsers = function renderVoiceUsersV208(wrap, channelId) {
      previousRenderVoiceUsers(wrap, channelId);
      const list = wrap.querySelector('.voice-user-list:last-child');
      if (!list) return;

      const entries = state.voicePresence.get(channelId) || [];
      const rows = [...list.querySelectorAll('.voice-user-row')];
      rows.forEach((row, index) => {
        row.querySelectorAll('.v207-watch-stream,.v208-watch-stream').forEach(el => el.remove());
        row.classList.remove('v208-has-stream');
        const entry = entries[index];
        if (!entry?.mediaState?.screen || entry.user?.id === state.user?.id) return;

        row.classList.add('v208-has-stream');
        const button = document.createElement('button');
        button.className = 'v208-watch-stream';
        button.textContent = '▶ Assistir transmissão';
        button.title = `Assistir transmissão de ${entry.user?.name || 'usuário'}`;
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          watchStream(state.selectedServer.id, channelId, entry.user.id);
        });
        row.insertBefore(button, row.firstChild);
      });
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    .voice-user-row.v208-has-stream{display:flex;flex-wrap:wrap;height:auto;min-height:34px;padding-top:4px}
    .v208-watch-stream{order:-1;width:calc(100% - 26px);margin:0 0 4px 26px;border:0;background:transparent;color:#f5c542;text-align:left;padding:1px 0;font-size:10px;font-weight:800;cursor:pointer}
    .v208-watch-stream:hover{text-decoration:underline;color:#ffe176}
    .v208-watch-target{outline:2px solid #f5c542;box-shadow:0 0 0 4px rgba(245,197,66,.12)}
  `;
  document.head.appendChild(style);
})();
