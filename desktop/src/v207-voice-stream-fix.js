/* Banana Cord V2.0.7 voice identity, ghost-session and stream navigation fixes. */
(() => {
  if (window.__bananaV207VoiceStreamFix) return;
  window.__bananaV207VoiceStreamFix = true;

  const snapshotsByServer = window.BananaVoiceSnapshotsByServer ||= new Map();

  const joinedAt = value => Number(value?.joinedAt || 0) || 0;
  const userIdOf = (socketId, value) => String(value?.userId || value?.user?.id || socketId || '');

  function normalizedSession(socketId, value = {}, channelId = '') {
    const userId = userIdOf(socketId, value);
    const user = { ...(value.user || {}), id: userId, name: value.user?.name || 'Amigo' };
    return { ...value, userId, user, socketId, channelId, mediaState: value.mediaState || {}, speaking: !!value.speaking };
  }

  // One account can have only one active voice session inside a server. This is
  // intentionally global across channels so an old session in another channel cannot
  // survive an updater crash and appear as a second copy of the same person.
  function dedupeServerTree(tree = {}, currentSocketId = '', localUid = '') {
    const newest = new Map();
    for (const [channelId, sessions] of Object.entries(tree || {})) {
      for (const [socketId, raw] of Object.entries(sessions || {})) {
        const value = normalizedSession(socketId, raw, channelId);
        const uid = value.userId;
        if (!uid) continue;
        const prev = newest.get(uid);
        const preferCurrent = uid === localUid && socketId === currentSocketId;
        const prevIsCurrent = uid === localUid && prev?.socketId === currentSocketId;
        const newer = joinedAt(value) > joinedAt(prev);
        const tieBreak = joinedAt(value) === joinedAt(prev) && String(socketId) > String(prev?.socketId || '');
        if (!prev || preferCurrent || (!prevIsCurrent && (newer || tieBreak))) newest.set(uid, value);
      }
    }
    const clean = {};
    for (const value of newest.values()) {
      clean[value.channelId] ||= {};
      clean[value.channelId][value.socketId] = value;
    }
    return clean;
  }

  function treeEntries(tree = {}) {
    const rows = [];
    for (const [channelId, sessions] of Object.entries(tree || {})) {
      for (const [socketId, value] of Object.entries(sessions || {})) rows.push(normalizedSession(socketId, value, channelId));
    }
    return rows;
  }

  function directoryLocation(socket, socketId) {
    for (const [serverId, dir] of socket?.__bananaV207VoiceDirectoryByServer?.entries?.() || []) {
      if (dir.has(socketId)) return { serverId, session: dir.get(socketId) };
    }
    return null;
  }

  function directorySession(socket, socketId) {
    return directoryLocation(socket, socketId)?.session || null;
  }

  function dedupePeerPayload(socket, peers = []) {
    const localUid = String(socket?.user?.uid || '');
    const byUser = new Map();
    for (const raw of peers || []) {
      const auth = directorySession(socket, raw?.socketId);
      const peer = auth ? { ...raw, user: auth.user, userId: auth.userId, joinedAt: auth.joinedAt } : raw;
      const uid = String(peer?.user?.id || peer?.userId || peer?.socketId || '');
      if (!uid || uid === localUid || peer?.socketId === socket?.id) continue;
      const prev = byUser.get(uid);
      const newer = joinedAt(peer) >= joinedAt(prev);
      if (!prev || newer) byUser.set(uid, peer);
    }
    return [...byUser.values()];
  }

  function cacheSnapshot(serverId, entries = []) {
    const localUid = String(state.user?.id || '');
    const byUser = new Map();
    for (const raw of entries || []) {
      const e = normalizedSession(raw.socketId, raw, raw.channelId);
      if (e.userId === localUid && e.socketId !== state.socket?.id) continue;
      const prev = byUser.get(e.userId);
      if (!prev || joinedAt(e) >= joinedAt(prev)) byUser.set(e.userId, e);
    }
    const clean = [...byUser.values()];
    snapshotsByServer.set(serverId, clean);
    return clean;
  }

  function applyCachedPresence(serverId) {
    const entries = snapshotsByServer.get(serverId);
    if (!entries || state.selectedServer?.id !== serverId) return;
    state.voicePresence = new Map();
    for (const e of entries) {
      const arr = state.voicePresence.get(e.channelId) || [];
      arr.push(e);
      state.voicePresence.set(e.channelId, arr);
    }
  }

  function reconcilePeers(socket, entries = []) {
    const bySocket = new Map(entries.map(e => [e.socketId, e]));
    const localUid = String(state.user?.id || socket?.user?.uid || '');
    const bestPeerByUser = new Map();
    for (const peer of [...state.voice.peers.values()]) {
      if (String(peer.user?.id || '') === localUid || peer.socketId === socket?.id) {
        try { removePeer(peer.socketId); } catch {}
        continue;
      }
      const authoritative = bySocket.get(peer.socketId) || directorySession(socket, peer.socketId);
      if (authoritative) {
        peer.user = authoritative.user;
        peer.mediaState = { ...peer.mediaState, ...authoritative.mediaState };
      }
      const uid = String(peer.user?.id || peer.socketId);
      const prev = bestPeerByUser.get(uid);
      if (!prev) bestPeerByUser.set(uid, peer);
      else {
        const prevAuth = directorySession(socket, prev.socketId);
        const curAuth = directorySession(socket, peer.socketId);
        if (joinedAt(curAuth) >= joinedAt(prevAuth)) {
          try { removePeer(prev.socketId); } catch {}
          bestPeerByUser.set(uid, peer);
        } else {
          try { removePeer(peer.socketId); } catch {}
        }
      }
    }
    for (const peer of state.voice.peers.values()) try { addRemoteCard(peer); } catch {}
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV207VoiceStreamPatched) return false;
    // During Electron startup/tests BananaLegacy can briefly receive a transport-like
    // socket before the complete Cloud voice socket is available. Never bind optional
    // methods until the mature socket surface exists; attachSocket retries below.
    if (typeof socket.receive !== 'function' || typeof socket.joinVoice !== 'function') return false;
    socket.__bananaV207VoiceStreamPatched = true;
    socket.__bananaV207VoiceDirectoryByServer ||= new Map();

    const { ref, get, remove, set, onDisconnect, serverTimestamp: rtdbTimestamp } = require('firebase/database');

    if (typeof socket.processVoiceServer === 'function') {
      const previousProcessVoiceServer = socket.processVoiceServer.bind(socket);
      socket.processVoiceServer = function processVoiceServerV207(serverId, tree) {
        const clean = dedupeServerTree(tree, this.id, this.user?.uid);
        const directory = new Map(treeEntries(clean).map(e => [e.socketId, e]));
        this.__bananaV207VoiceDirectoryByServer.set(serverId, directory);
        return previousProcessVoiceServer(serverId, clean);
      };
    }

    // Replace joinVoice so room capacity and the initial peer list count unique users,
    // not stale Firebase sessions left by an abrupt restart.
    socket.joinVoice = async function joinVoiceV207(payload) {
      if (!this.rtdb) return;
      const server = await this.loadServer(payload.serverId);
      const channel = server?.channels.find(c => c.id === payload.channelId && c.type === 'voice');
      if (!channel) throw new Error('Você não tem acesso a essa sala de voz.');
      if (this.voice) await this.leaveVoice();

      const serverRoot = ref(this.rtdb, `voiceRooms/${payload.serverId}`);
      const serverSnap = await get(serverRoot);
      const rawTree = serverSnap.val() || {};

      // Remove stale sessions that belong to this exact account in any channel.
      const staleRemovals = [];
      for (const [channelId, sessions] of Object.entries(rawTree)) {
        for (const [socketId, session] of Object.entries(sessions || {})) {
          if (socketId !== this.id && session?.userId === this.user.uid) {
            staleRemovals.push(remove(ref(this.rtdb, `voiceRooms/${payload.serverId}/${channelId}/${socketId}`)).catch(() => {}));
          }
        }
      }
      if (staleRemovals.length) await Promise.all(staleRemovals);

      const targetSessions = rawTree[payload.channelId] || {};
      const cleanTargetTree = dedupeServerTree({ [payload.channelId]: targetSessions }, this.id, this.user.uid);
      const uniqueOthers = treeEntries(cleanTargetTree).filter(e => e.userId !== this.user.uid && e.socketId !== this.id);
      if (uniqueOthers.length >= 5) {
        this.receive('voice:full');
        return;
      }

      const me = await this.publicUser(this.user.uid);
      this.voice = { serverId: payload.serverId, channelId: payload.channelId };
      const myRef = ref(this.rtdb, `voiceRooms/${payload.serverId}/${payload.channelId}/${this.id}`);
      await set(myRef, {
        userId: this.user.uid,
        user: me,
        mediaState: { muted: false, camera: false, screen: false },
        speaking: false,
        joinedAt: rtdbTimestamp()
      });
      await onDisconnect(myRef).remove();
      this.receive('voice:peers', {
        channelId: payload.channelId,
        peers: uniqueOthers.map(e => ({ socketId: e.socketId, user: e.user, userId: e.userId, mediaState: e.mediaState, joinedAt: e.joinedAt }))
      });
    };

    const previousReceive = socket.receive.bind(socket);
    socket.receive = function receiveV207(event, payload = {}) {
      const localUid = String(this.user?.uid || state.user?.id || '');

      if (event === 'voice:snapshot' && Array.isArray(payload.entries)) {
        const entries = cacheSnapshot(payload.serverId, payload.entries);
        payload = { ...payload, entries };
        reconcilePeers(this, entries);
      }

      if (event === 'voice:peers' && Array.isArray(payload.peers)) {
        payload = { ...payload, peers: dedupePeerPayload(this, payload.peers) };
      }

      if (event === 'voice:user-joined') {
        const auth = directorySession(this, payload.socketId);
        const user = auth?.user || payload.user || {};
        const uid = String(auth?.userId || user?.id || '');
        if (!uid || uid === localUid || payload.socketId === this.id) return;
        payload = { ...payload, user: { ...user, id: uid }, mediaState: auth?.mediaState || payload.mediaState || {} };
        const duplicates = [...state.voice.peers.values()].filter(p => p.socketId !== payload.socketId && p.user?.id === uid);
        for (const peer of duplicates) {
          const oldAuth = directorySession(this, peer.socketId);
          if (joinedAt(oldAuth) > joinedAt(auth)) return;
          try { removePeer(peer.socketId); } catch {}
        }
      }

      if (event === 'webrtc:signal') {
        const auth = directorySession(this, payload.fromSocketId);
        const uid = String(auth?.userId || payload.fromUser?.id || '');
        if (payload.fromSocketId === this.id || (uid && uid === localUid)) return;
        if (auth) payload = { ...payload, fromUser: auth.user };
      }

      // Never fall back to userId for media/speaking state when a socketId is supplied.
      // The old OR lookup could assign a screen-share flag to the wrong card after a
      // stale session survived an update. Also resolve the server from that socket, not
      // from whichever server the user happens to be browsing at the moment.
      if (event === 'voice:media-state-global' && payload.socketId) {
        const location = directoryLocation(this, payload.socketId);
        const targetServerId = location?.serverId;
        const cached = snapshotsByServer.get(targetServerId) || [];
        const entry = cached.find(e => e.socketId === payload.socketId && e.channelId === payload.channelId);
        if (entry) {
          entry.mediaState = { ...entry.mediaState, ...(payload.mediaState || {}) };
          if (state.selectedServer?.id === targetServerId) {
            applyCachedPresence(targetServerId);
            renderChannels();
          }
        }
        return;
      }
      if (event === 'voice:speaking-global' && payload.socketId) {
        const location = directoryLocation(this, payload.socketId);
        const targetServerId = location?.serverId;
        const cached = snapshotsByServer.get(targetServerId) || [];
        const entry = cached.find(e => e.socketId === payload.socketId && e.channelId === payload.channelId);
        if (entry) {
          entry.speaking = !!payload.speaking;
          if (state.selectedServer?.id === targetServerId) {
            applyCachedPresence(targetServerId);
            renderChannels();
          }
        }
        return;
      }

      if (event === 'server:removed' && payload.serverId === state.voice.serverId) {
        setTimeout(() => Promise.resolve(leaveVoice()).catch(() => {}), 0);
      }
      if (event === 'server:updated' && payload?.id === state.voice.serverId) {
        const stillExists = payload.channels?.some(c => c.id === state.voice.channelId && c.type === 'voice');
        if (!stillExists) setTimeout(() => { leaveVoice(); toast('O canal de voz em que você estava foi removido.'); }, 0);
      }

      return previousReceive(event, payload);
    };

    return true;
  }

  window.BananaV207PatchVoiceSocket = patchSocket;
  patchSocket(window.BananaCloudSocket);
  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketVoiceV207(socket, user) {
      // Let the mature bridge bind its handlers/state first. A partial test/transport
      // socket is allowed to pass through unmodified; the real Cloud socket patches here.
      const result = previousAttachSocket(socket, user);
      patchSocket(socket);
      return result;
    };
  }

  // Renderer-side safety: a remote card can never represent the local authenticated UID.
  const previousAddRemoteCard = addRemoteCard;
  addRemoteCard = function addRemoteCardV207(peer) {
    const localUid = String(state.user?.id || '');
    const auth = directorySession(state.socket, peer?.socketId);
    if (auth) {
      peer.user = auth.user;
      peer.mediaState = { ...peer.mediaState, ...auth.mediaState };
    }
    if (!peer || peer.socketId === state.socket?.id || (localUid && peer.user?.id === localUid)) {
      const card = peer?.socketId ? document.getElementById(`video-${peer.socketId}`) : null;
      card?.remove();
      if (peer?.socketId && state.voice.peers.has(peer.socketId)) {
        try { peer.pc?.close(); } catch {}
        state.voice.peers.delete(peer.socketId);
      }
      return;
    }
    return previousAddRemoteCard(peer);
  };

  const previousHandleSignal = handleSignal;
  handleSignal = async function handleSignalV207(socketId, user, data) {
    const auth = directorySession(state.socket, socketId);
    const fixedUser = auth?.user || user || {};
    if (socketId === state.socket?.id || (fixedUser?.id && fixedUser.id === state.user?.id)) return;
    return previousHandleSignal(socketId, fixedUser, data);
  };

  const previousSelectServer = selectServer;
  selectServer = function selectServerV207(id) {
    previousSelectServer(id);
    applyCachedPresence(id);
    if (state.selectedServer?.id === id) renderChannels();
  };

  function findBroadcast(userId) {
    for (const [serverId, entries] of snapshotsByServer) {
      const entry = (entries || []).find(e => e.user?.id === userId && e.mediaState?.screen);
      if (entry) return { serverId, channelId: entry.channelId, entry };
    }
    return null;
  }

  async function watchBroadcast(userId, serverId, channelId) {
    const server = state.servers.find(s => s.id === serverId);
    const channel = server?.channels?.find(c => c.id === channelId && c.type === 'voice');
    if (!server || !channel) return toast('Essa transmissão não está mais disponível.');

    const alreadyThere = state.voice.serverId === serverId && state.voice.channelId === channelId;
    if (!alreadyThere && state.voice.channelId) {
      const ok = confirm('Você está em outra call. Assistir esta transmissão vai trocar você para a call dela. Continuar?');
      if (!ok) return;
    }

    if (state.selectedServer?.id !== serverId) selectServer(serverId);
    selectChannel(channelId);
    if (!alreadyThere) await joinVoice(channel);

    state.ui.showAllOverride = false;
    state.ui.focusSharing = true;
    applyFocusSharing();

    const focus = () => {
      const peer = [...state.voice.peers.values()].find(p => p.user?.id === userId && p.mediaState?.screen);
      const card = peer ? document.getElementById(`video-${peer.socketId}`) : null;
      if (!card) return;
      card.classList.add('v207-watch-target');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('v207-watch-target'), 1800);
    };
    setTimeout(focus, 250);
    setTimeout(focus, 1000);
  }
  window.BananaWatchBroadcast = watchBroadcast;

  const style = document.createElement('style');
  style.textContent = `
    .v207-watch-stream{margin-left:auto;border:1px solid rgba(245,197,66,.45);background:rgba(245,197,66,.12);color:#ffd85b;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
    .v207-watch-stream:hover{background:rgba(245,197,66,.22)}
    .v207-watch-target{outline:2px solid #f5c542;box-shadow:0 0 0 4px rgba(245,197,66,.12)}
    .v207-profile-watch{margin-top:10px;background:#f5c542!important;color:#181200!important;font-weight:800}
  `;
  document.head.appendChild(style);

  const previousRenderVoiceUsers = renderVoiceUsers;
  renderVoiceUsers = function renderVoiceUsersV207(wrap, channelId) {
    previousRenderVoiceUsers(wrap, channelId);
    const list = wrap.querySelector('.voice-user-list:last-child');
    if (!list) return;
    const entries = state.voicePresence.get(channelId) || [];
    const rows = [...list.querySelectorAll('.voice-user-row')];
    rows.forEach((row, index) => {
      const e = entries[index];
      if (!e?.mediaState?.screen || e.user?.id === state.user?.id) return;
      const watch = document.createElement('button');
      watch.className = 'v207-watch-stream';
      watch.textContent = '▶ Assistir transmissão';
      watch.title = `Assistir transmissão de ${e.user?.name || 'usuário'}`;
      watch.addEventListener('click', event => {
        event.stopPropagation();
        watchBroadcast(e.user.id, state.selectedServer.id, channelId);
      });
      row.appendChild(watch);
    });
  };

  const previousOpenMemberProfile = openMemberProfile;
  openMemberProfile = function openMemberProfileV207(userId) {
    previousOpenMemberProfile(userId);
    const live = findBroadcast(userId);
    if (!live) return;
    const preview = document.querySelector('.profile-preview');
    if (!preview || document.getElementById('v207ProfileWatch')) return;
    const button = document.createElement('button');
    button.id = 'v207ProfileWatch';
    button.className = 'action v207-profile-watch';
    button.textContent = '▶ Assistir transmissão';
    button.onclick = () => {
      closeModal();
      watchBroadcast(userId, live.serverId, live.channelId);
    };
    preview.appendChild(button);
  };
})();
