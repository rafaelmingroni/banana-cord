/* Banana Cord V2.0.20 — bounded chat subscriptions + progressive history + anti-flood. */
(() => {
  if (window.__bananaV220ChatCloud) return;
  window.__bananaV220ChatCloud = true;

  const {
    collection, onSnapshot, query, orderBy, limit
  } = require('firebase/firestore');

  const PAGE = 60;
  const MAX = 240;
  const FLOOD_CAPACITY = 6;
  const FLOOD_REFILL_MS = 800;
  const now = () => Date.now();
  const pairId = (a, b) => [String(a), String(b)].sort().join('_');
  function millis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    return Number(value) || 0;
  }
  function mapMessage(snap, serverId, channelId) {
    const d = snap.data() || {};
    return {
      id: snap.id, serverId, channelId,
      authorId: d.authorId || '', text: d.text || d.body || '',
      at: millis(d.createdAt) || now(), editedAt: millis(d.editedAt) || null,
      replyToId: d.replyToId || d.replyTo || null,
      reactions: d.reactions || {}, mentionIds: d.mentionIds || []
    };
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV220ChatPatched) return false;
    if (!socket.db || typeof socket.receive !== 'function') return false;
    socket.__bananaV220ChatPatched = true;
    socket.__bananaMessageHistoryCount = new Map();
    socket.__bananaDmHistoryCount = new Map();
    socket.__bananaMessageHistoryHasMore = new Map();
    socket.__bananaDmHistoryHasMore = new Map();
    socket.__bananaFlood = { tokens: FLOOD_CAPACITY, updatedAt: now() };

    socket.takeMessagePermitV220 = function takeMessagePermitV220() {
      const stamp = now();
      const guard = this.__bananaFlood || (this.__bananaFlood = { tokens: FLOOD_CAPACITY, updatedAt: stamp });
      const elapsed = Math.max(0, stamp - Number(guard.updatedAt || stamp));
      if (elapsed >= FLOOD_REFILL_MS) {
        guard.tokens = Math.min(FLOOD_CAPACITY, Number(guard.tokens || 0) + Math.floor(elapsed / FLOOD_REFILL_MS));
        guard.updatedAt = stamp - (elapsed % FLOOD_REFILL_MS);
      }
      if (guard.tokens < 1) {
        const waitMs = Math.max(250, FLOOD_REFILL_MS - (stamp - guard.updatedAt));
        const seconds = Math.max(1, Math.ceil(waitMs / 1000));
        throw new Error(`Você está enviando mensagens rápido demais. Aguarde ${seconds}s.`);
      }
      guard.tokens -= 1;
      return true;
    };

    const sendMessageBase = typeof socket.sendMessage === 'function' ? socket.sendMessage.bind(socket) : null;
    if (sendMessageBase) {
      socket.sendMessage = async function sendMessageV220(payload = {}) {
        this.takeMessagePermitV220();
        return sendMessageBase(payload);
      };
    }

    // This patch is deliberately applied after V2.0.16 E2EE, so the DM wrapper
    // rate-limits the encrypted send path instead of replacing encryption.
    const sendDmBase = typeof socket.sendDm === 'function' ? socket.sendDm.bind(socket) : null;
    if (sendDmBase) {
      socket.sendDm = async function sendDmV220(payload = {}) {
        this.takeMessagePermitV220();
        return sendDmBase(payload);
      };
    }

    socket.watchMessages = async function watchMessagesV220(serverId, channelId, requestedCount = PAGE) {
      const count = Math.min(MAX, Math.max(PAGE, Number(requestedCount) || PAGE));
      this.__bananaMessageHistoryCount.set(channelId, count);
      this.messageCleanup.get(channelId)?.();
      let first = true;
      const q = query(
        collection(this.db, 'servers', serverId, 'channels', channelId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
      const off = onSnapshot(q, snap => {
        this.__bananaMessageHistoryHasMore.set(channelId, snap.size >= count && count < MAX);
        if (first) {
          first = false;
          const messages = snap.docs.map(d => mapMessage(d, serverId, channelId)).reverse();
          this.receive('messages:list', { channelId, messages, historyCount: count });
          return;
        }
        for (const change of snap.docChanges()) {
          const m = mapMessage(change.doc, serverId, channelId);
          if (change.type === 'added') this.receive('message:new', m);
          else if (change.type === 'modified') this.receive('message:updated', m);
          else this.receive('message:deleted', { channelId, messageId: change.doc.id });
        }
      }, error => this.receive('app:error', this.friendly(error)));
      this.messageCleanup.set(channelId, off);
    };

    socket.loadOlderMessagesV220 = function loadOlderMessagesV220(serverId, channelId) {
      const current = this.__bananaMessageHistoryCount.get(channelId) || PAGE;
      if (current >= MAX || this.__bananaMessageHistoryHasMore.get(channelId) === false) return false;
      const next = Math.min(MAX, current + PAGE);
      this.watchMessages(serverId, channelId, next);
      return true;
    };

    socket.watchDm = async function watchDmV220(peerId, requestedCount = PAGE) {
      if (!(await this.canDm(peerId))) throw new Error('Essa conversa privada não está disponível.');
      if (!this.__bananaE2EEReady) await this.ensureE2EEIdentity();
      const peerCurrentKey = await this.e2eePublicKey(peerId);
      this.receive('dm:e2ee-status', {
        available: !!peerCurrentKey,
        userId: peerId,
        reason: peerCurrentKey ? '' : 'O contato ainda não publicou uma chave de criptografia.'
      });
      const count = Math.min(MAX, Math.max(PAGE, Number(requestedCount) || PAGE));
      this.__bananaDmHistoryCount.set(peerId, count);
      const tid = pairId(this.user.uid, peerId);
      this.dmCleanup.get(peerId)?.();
      let first = true;
      const q = query(
        collection(this.db, 'dmThreads', tid, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
      const off = onSnapshot(q, async snap => {
        this.__bananaDmHistoryHasMore.set(peerId, snap.size >= count && count < MAX);
        const user = await this.publicUser(peerId);
        if (first) {
          first = false;
          const messages = await Promise.all([...snap.docs].reverse().map(row => this.decryptDmV216(row)));
          this.receive('dm:list', { user, messages, historyCount: count });
          return;
        }
        for (const change of snap.docChanges()) {
          const message = await this.decryptDmV216(change.doc);
          if (change.type === 'added') {
            this.receive('dm:new', {
              message,
              from: message.fromId === this.user.uid ? await this.publicUser(this.user.uid) : user,
              to: message.toId === this.user.uid ? await this.publicUser(this.user.uid) : user
            });
          } else if (change.type === 'modified') {
            this.receive('dm:updated', { userId: peerId, message });
          } else {
            this.receive('dm:deleted', { userId: peerId, messageId: change.doc.id });
          }
        }
      }, error => this.receive('app:error', this.friendly(error)));
      this.dmCleanup.set(peerId, off);
    };

    socket.loadOlderDmV220 = function loadOlderDmV220(peerId) {
      const current = this.__bananaDmHistoryCount.get(peerId) || PAGE;
      if (current >= MAX || this.__bananaDmHistoryHasMore.get(peerId) === false) return false;
      const next = Math.min(MAX, current + PAGE);
      this.watchDm(peerId, next);
      return true;
    };

    return true;
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttach = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV220(socket, user) {
      // Let V2.0.16 install its E2EE wrappers first. V2.0.20 then layers
      // pagination and anti-flood on top of the final encrypted DM methods.
      const result = previousAttach(socket, user);
      patchSocket(socket);
      return result;
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV220PatchCloudSocket = patchSocket;
})();
