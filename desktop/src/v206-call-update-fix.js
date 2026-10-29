/* Banana Cord V2.0.6 critical call/update restart fix. */
(() => {
  if (window.__bananaV206CallUpdateFix) return;
  window.__bananaV206CallUpdateFix = true;

  function newestByUser(entries = []) {
    const byUser = new Map();
    for (const [socketId, value] of entries) {
      const userId = value?.userId || value?.user?.id || socketId;
      const prev = byUser.get(userId);
      const joinedAt = Number(value?.joinedAt || 0);
      const prevAt = Number(prev?.[1]?.joinedAt || 0);
      if (!prev || joinedAt >= prevAt) byUser.set(userId, [socketId, value]);
    }
    return [...byUser.values()];
  }

  function dedupeVoiceTree(tree = {}) {
    const clean = {};
    for (const [channelId, sessions] of Object.entries(tree || {})) {
      const entries = newestByUser(Object.entries(sessions || {}));
      clean[channelId] = Object.fromEntries(entries);
    }
    return clean;
  }

  function dedupePeers(peers = []) {
    const byUser = new Map();
    for (const peer of peers || []) {
      const userId = peer?.user?.id || peer?.userId || peer?.socketId;
      byUser.set(userId, peer); // later entry wins; Firebase object order keeps newer session last in practice
    }
    return [...byUser.values()];
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV206CallUpdatePatched) return false;
    socket.__bananaV206CallUpdatePatched = true;

    const { ref, get, remove } = require('firebase/database');

    if (typeof socket.processVoiceServer === 'function') {
      const originalProcessVoiceServer = socket.processVoiceServer.bind(socket);
      socket.processVoiceServer = function processVoiceServerV206(serverId, tree) {
        return originalProcessVoiceServer(serverId, dedupeVoiceTree(tree));
      };
    }

    if (typeof socket.receive === 'function') {
      const originalReceive = socket.receive.bind(socket);
      socket.receive = function receiveV206(event, payload) {
        if (event === 'voice:peers' && Array.isArray(payload?.peers)) {
          payload = { ...payload, peers: dedupePeers(payload.peers) };
        }
        return originalReceive(event, payload);
      };
    }

    if (typeof socket.joinVoice === 'function') {
      const originalJoinVoice = socket.joinVoice.bind(socket);
      socket.joinVoice = async function joinVoiceV206(payload) {
        if (this.rtdb && payload?.serverId) {
          try {
            const root = ref(this.rtdb, `voiceRooms/${payload.serverId}`);
            const snap = await get(root);
            const tree = snap.val() || {};
            const removals = [];
            for (const [channelId, sessions] of Object.entries(tree)) {
              for (const [socketId, session] of Object.entries(sessions || {})) {
                if (socketId !== this.id && session?.userId === this.user.uid) {
                  removals.push(remove(ref(this.rtdb, `voiceRooms/${payload.serverId}/${channelId}/${socketId}`)).catch(() => {}));
                }
              }
            }
            if (removals.length) await Promise.all(removals);
          } catch (error) {
            console.warn('Banana Cord: não consegui limpar sessões antigas de voz.', error);
          }
        }
        return originalJoinVoice(payload);
      };
    }

    return true;
  }

  window.BananaV206PatchCallSocket = patchSocket;
  patchSocket(window.BananaCloudSocket);

  if (window.BananaLegacy?.attachSocket) {
    const originalAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketCallV206(socket, user) {
      patchSocket(socket);
      return originalAttachSocket(socket, user);
    };
  }
})();
