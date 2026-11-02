/* Banana Cord V2.1 — presence/activity + safer chat management. */
(() => {
  if (window.__bananaV21SocialCloud) return;
  window.__bananaV21SocialCloud = true;

  const {
    doc, collection, getDoc, getDocs, query, orderBy, limit, writeBatch
  } = require('firebase/firestore');
  const {
    ref, update, onValue,
    serverTimestamp: rtdbTimestamp
  } = require('firebase/database');

  const ROLE_RANK_V21 = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const PRESENCE_STATES = new Set(['online', 'away', 'busy', 'offline']);
  const pairId = (a, b) => [String(a), String(b)].sort().join('_');

  function safeActivity(value) {
    if (!value || typeof value !== 'object') return null;
    const id = String(value.id || '').trim().slice(0, 64);
    const name = String(value.name || '').trim().slice(0, 80);
    const startedAt = Number(value.startedAt || 0);
    if (!id || !name || !Number.isFinite(startedAt) || startedAt <= 0) return null;
    return { id, name, startedAt };
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV21SocialCloudPatched || !socket.user || !socket.db) return false;
    socket.__bananaV21SocialCloudPatched = true;
    socket.__bananaPresenceWrite = Promise.resolve();

    const publicUserBase = socket.publicUser.bind(socket);
    socket.publicUser = async function publicUserV21(uid) {
      const user = await publicUserBase(uid);
      if (!user) return user;
      const presence = this.presence?.get?.(uid) || {};
      return { ...user, activity: safeActivity(presence.activity) };
    };

    socket.watchPresence = function watchPresenceV21() {
      if (!this.rtdb || this.__bananaV21PresenceWatch) return;
      this.__bananaV21PresenceWatch = true;
      const off = onValue(ref(this.rtdb, 'presence'), snap => {
        const next = new Map(Object.entries(snap.val() || {}));
        for (const [uid, value] of next) {
          const before = this.presence.get(uid) || {};
          const activityChanged = JSON.stringify(before.activity || null) !== JSON.stringify(value?.activity || null);
          if (!before || before.state !== value?.state || before.lastChanged !== value?.lastChanged || activityChanged) {
            this.presence.set(uid, value || {});
            this.publicUser(uid).then(user => user && this.receive('presence:update', user)).catch(() => {});
          }
        }
        this.presence = next;
      });
      this.cleanup.push(off);
    };

    socket.setPresenceV21 = async function setPresenceV21(payload = {}) {
      if (!this.rtdb) return;
      const next = String(payload.state || 'online');
      if (!PRESENCE_STATES.has(next) || next === 'offline') throw new Error('Status inválido.');
      const write = () => update(ref(this.rtdb, `presence/${this.user.uid}`), {
        state: next,
        lastChanged: rtdbTimestamp()
      });
      this.__bananaPresenceWrite = this.__bananaPresenceWrite.catch(() => {}).then(write);
      await this.__bananaPresenceWrite;
    };

    socket.setActivityV21 = async function setActivityV21(payload = {}) {
      if (!this.rtdb) return;
      const activity = safeActivity(payload.activity);
      const write = () => update(ref(this.rtdb, `presence/${this.user.uid}`), {
        activity: activity || null,
        lastChanged: rtdbTimestamp()
      });
      // Presence and activity are intentionally serialized. On first login the
      // RTDB rule requires state+lastChanged to exist before the optional activity
      // field is merged, and this also prevents activity from racing an Away update.
      this.__bananaPresenceWrite = this.__bananaPresenceWrite.catch(() => {}).then(write);
      await this.__bananaPresenceWrite;
    };

    const editMessageBase = socket.editMessage.bind(socket);
    socket.editMessage = async function editMessageV21(payload = {}) {
      const messageRef = doc(this.db, 'servers', payload.serverId, 'channels', payload.channelId, 'messages', payload.messageId);
      const snap = await getDoc(messageRef);
      if (!snap.exists()) return;
      if (snap.data().authorId !== this.user.uid) throw new Error('Você só pode editar suas próprias mensagens.');
      return editMessageBase(payload);
    };

    socket.clearMessagesV21 = async function clearMessagesV21(payload = {}) {
      const serverId = String(payload.serverId || '');
      const channelId = String(payload.channelId || '');
      if (!serverId || !channelId) throw new Error('Canal inválido.');
      const role = await this.role(serverId);
      const moderator = (ROLE_RANK_V21[role] || 0) >= ROLE_RANK_V21.moderator;
      const mode = String(payload.mode || 'mine') === 'all' && moderator ? 'all' : 'mine';
      const amount = Math.max(1, Math.min(100, Number(payload.amount || 20) || 20));
      const messages = collection(this.db, 'servers', serverId, 'channels', channelId, 'messages');

      // `/clear all` arrives as moderator mode=all with the maximum amount. Work
      // in 400-write batches so the command really clears the channel instead of
      // silently stopping at the first 100 messages.
      if (mode === 'all' && amount === 100) {
        let count = 0;
        while (true) {
          const snap = await getDocs(query(messages, orderBy('createdAt', 'desc'), limit(400)));
          if (snap.empty) break;
          const batch = writeBatch(this.db);
          for (const row of snap.docs) batch.delete(row.ref);
          await batch.commit();
          count += snap.size;
          if (snap.size < 400) break;
        }
        return { count, mode, all: true };
      }

      const snap = await getDocs(query(messages, orderBy('createdAt', 'desc'), limit(400)));
      const targets = [];
      for (const row of snap.docs) {
        if (mode === 'all' || row.data()?.authorId === this.user.uid) targets.push(row);
        if (targets.length >= amount) break;
      }
      if (!targets.length) return { count: 0, mode };
      const batch = writeBatch(this.db);
      for (const row of targets) batch.delete(row.ref);
      await batch.commit();
      return { count: targets.length, mode };
    };

    socket.clearDmV21 = async function clearDmV21(payload = {}) {
      const peerId = String(payload.userId || '');
      if (!peerId) throw new Error('Conversa inválida.');
      const amount = Math.max(1, Math.min(100, Number(payload.amount || 20) || 20));
      const tid = pairId(this.user.uid, peerId);
      const q = query(collection(this.db, 'dmThreads', tid, 'messages'), orderBy('createdAt', 'desc'), limit(400));
      const snap = await getDocs(q);
      const targets = snap.docs.filter(row => row.data()?.fromId === this.user.uid).slice(0, amount);
      if (!targets.length) return { count: 0, mode: 'mine' };
      const batch = writeBatch(this.db);
      for (const row of targets) batch.delete(row.ref);
      await batch.commit();
      return { count: targets.length, mode: 'mine' };
    };

    const handleBase = socket.handle.bind(socket);
    socket.handle = async function handleV21(event, payload = {}, ack) {
      try {
        if (event === 'presence:set') {
          await this.setPresenceV21(payload);
          ack?.({ ok: true });
          return;
        }
        if (event === 'presence:activity') {
          await this.setActivityV21(payload);
          ack?.({ ok: true });
          return;
        }
        if (event === 'messages:clear') {
          const result = await this.clearMessagesV21(payload);
          ack?.({ ok: true, ...result });
          return result;
        }
        if (event === 'dm:clear') {
          const result = await this.clearDmV21(payload);
          ack?.({ ok: true, ...result });
          return result;
        }
        return handleBase(event, payload, ack);
      } catch (error) {
        if (['presence:set', 'presence:activity', 'messages:clear', 'dm:clear'].includes(event)) {
          ack?.({ ok: false, message: this.friendly(error) });
          this.receive('app:error', this.friendly(error));
          return;
        }
        throw error;
      }
    };

    return true;
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttach = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV21(socket, user) {
      patchSocket(socket);
      return previousAttach(socket, user);
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV21PatchCloudSocket = patchSocket;
})();
