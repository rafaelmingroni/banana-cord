/* Mingrx 3.1.1 follow-up — updater ghost cleanup + server-photo compatibility. */
(() => {
  if (window.__mingrx311FollowupLoaded) return;
  window.__mingrx311FollowupLoaded = true;

  const orphanSince = new Map();
  const ORPHAN_GRACE_MS = 6000;

  function safeIcon(value) {
    return window.Mingrx311?.safeIcon?.(value) || '';
  }

  function syncServerPhotoBackgrounds() {
    const list = document.getElementById('serverList');
    if (!list) return;
    for (const button of list.querySelectorAll('.server-icon[data-server-id]')) {
      const server = (state.servers || []).find(item => String(item.id) === String(button.dataset.serverId));
      const icon = safeIcon(server?.icon);
      if (!icon) {
        button.style.backgroundImage = '';
        continue;
      }
      // Keep the mature background-image contract for older render/tests while the
      // 3.1.1 hotfix also renders a real <img> above it for reliable display.
      button.style.backgroundImage = `url("${icon.replace(/"/g, '%22')}")`;
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
      button.style.backgroundRepeat = 'no-repeat';
    }
  }

  if (typeof renderServers === 'function' && !renderServers.__mingrx311FollowupWrapped) {
    const baseRenderServers = renderServers;
    renderServers = function renderServersMingrx311Followup(...args) {
      const result = baseRenderServers.apply(this, args);
      syncServerPhotoBackgrounds();
      return result;
    };
    renderServers.__mingrx311FollowupWrapped = true;
  }

  function peerDead(peer) {
    if (!peer) return false;
    if (window.Mingrx311?.connectionDead?.(peer)) return true;
    const pc = peer.pc;
    const connection = String(pc?.connectionState || '').toLowerCase();
    const ice = String(pc?.iceConnectionState || '').toLowerCase();
    return ['failed','closed','disconnected'].includes(connection)
      || ['failed','closed','disconnected'].includes(ice);
  }

  function orphanKey(serverId, channelId, row) {
    return `${serverId}:${channelId}:${row?.socketId || row?.userId || row?.user?.id || ''}`;
  }

  function pruneOrphanVoiceRows({ force = false } = {}) {
    const serverId = String(state.voice?.serverId || '');
    const channelId = String(state.voice?.channelId || '');
    if (!serverId || !channelId) return false;

    const rows = [...(state.voicePresence.get(channelId) || [])];
    if (!rows.length) return false;

    const localUid = String(state.user?.id || '');
    const localSocketId = String(state.socket?.id || '');
    const peers = [...(state.voice?.peers?.values?.() || [])];
    const bySocket = new Map(peers.map(peer => [String(peer?.socketId || ''), peer]));
    const byUser = new Map(peers.map(peer => [String(peer?.user?.id || ''), peer]));
    const now = Date.now();
    const next = [];

    for (const row of rows) {
      const uid = String(row?.userId || row?.user?.id || '');
      const socketId = String(row?.socketId || '');
      if ((localUid && uid === localUid) || (localSocketId && socketId === localSocketId)) {
        orphanSince.delete(orphanKey(serverId, channelId, row));
        next.push(row);
        continue;
      }

      const peer = bySocket.get(socketId) || byUser.get(uid) || null;
      const key = orphanKey(serverId, channelId, row);
      if (peer && !peerDead(peer)) {
        orphanSince.delete(key);
        next.push(row);
        continue;
      }

      const since = orphanSince.get(key) || now;
      orphanSince.set(key, since);
      const deadNow = peerDead(peer);
      const expired = force || deadNow || (now - since >= ORPHAN_GRACE_MS);
      if (!expired) next.push(row);
      else orphanSince.delete(key);
    }

    if (next.length === rows.length) return false;
    state.voicePresence.set(channelId, next);
    return true;
  }

  function repairVoiceUi({ force = false } = {}) {
    const changed = pruneOrphanVoiceRows({ force });
    if (changed && state.viewMode === 'server' && state.selectedServer?.id === state.voice?.serverId) {
      try { renderChannels(); } catch {}
    }
    return changed;
  }

  function bindVoiceEvents(socket) {
    if (!socket?.on || socket.__mingrx311FollowupVoiceBound) return;
    socket.__mingrx311FollowupVoiceBound = true;
    for (const event of ['voice:snapshot','voice:user-left','voice:user-joined','voice:peers','voice:media-state']) {
      socket.on(event, () => queueMicrotask(() => repairVoiceUi()));
    }
  }

  if (typeof bindSocket === 'function' && !bindSocket.__mingrx311FollowupWrapped) {
    const baseBindSocket = bindSocket;
    bindSocket = function bindSocketMingrx311Followup(socket) {
      const result = baseBindSocket(socket);
      bindVoiceEvents(socket);
      return result;
    };
    bindSocket.__mingrx311FollowupWrapped = true;
  }
  bindVoiceEvents(state.socket);

  // A user that restarted for an update may remain in the RTDB snapshot briefly even
  // after their media peer vanished. Do not let that stale transport row live forever.
  setInterval(() => repairVoiceUi(), 1000);

  queueMicrotask(syncServerPhotoBackgrounds);

  window.Mingrx311Followup = Object.freeze({
    syncServerPhotoBackgrounds,
    pruneOrphanVoiceRows,
    repairVoiceUi,
    get orphanGraceMs() { return ORPHAN_GRACE_MS; }
  });
})();
