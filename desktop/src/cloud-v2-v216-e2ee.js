/* Banana Cord V2.0.16 — end-to-end encrypted private messages.
 * New DMs are encrypted before Firestore. Legacy plaintext DMs stay readable.
 */
(() => {
  if (window.__bananaV216E2EECloud) return;
  window.__bananaV216E2EECloud = true;

  const {
    doc, collection, getDoc, setDoc, updateDoc, onSnapshot,
    query, where, orderBy, limit, serverTimestamp, writeBatch
  } = require('firebase/firestore');

  const now = () => Date.now();
  const pairId = (a, b) => [String(a), String(b)].sort().join('_');
  function millis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    return Number(value) || 0;
  }

  function legacyDm(snap) {
    const d = snap.data() || {};
    return {
      id: snap.id,
      fromId: d.fromId || d.authorId || '',
      toId: d.toId || '',
      text: d.text || d.body || '',
      at: millis(d.createdAt) || now(),
      editedAt: millis(d.editedAt) || null,
      replyToId: d.replyToId || null,
      reactions: d.reactions || {},
      e2ee: false
    };
  }

  function patchSocket(socket) {
    if (!socket || socket.__bananaV216E2EEPatched) return false;
    if (typeof socket.handle !== 'function' || !socket.user || !socket.db) return false;
    socket.__bananaV216E2EEPatched = true;
    socket.__bananaE2EEKeyCache = new Map();
    socket.__bananaE2EEReady = false;

    socket.ensureE2EEIdentity = async function ensureE2EEIdentityV216() {
      if (!window.BananaE2EE) throw new Error('Módulo de criptografia do Banana Cord não foi carregado.');
      const local = await window.BananaE2EE.ensureKeypair(this.user.uid);
      const parentRef = doc(this.db, 'e2eeKeys', this.user.uid);
      const keyRef = doc(this.db, 'e2eeKeys', this.user.uid, 'keys', local.keyId);
      const existing = await getDoc(keyRef);
      if (!existing.exists()) {
        await setDoc(keyRef, {
          keyId: local.keyId,
          publicKey: local.publicKey,
          algorithm: 'X25519',
          createdAt: serverTimestamp()
        });
      }
      await setDoc(parentRef, {
        currentKeyId: local.keyId,
        algorithm: 'X25519',
        updatedAt: serverTimestamp()
      }, { merge: true });
      this.__bananaE2EEKeyCache.set(`${this.user.uid}:${local.keyId}`, {
        keyId: local.keyId,
        publicKey: local.publicKey,
        algorithm: 'X25519'
      });
      this.__bananaE2EEReady = true;
      this.receive('dm:e2ee-status', { available: true, userId: this.user.uid, keyId: local.keyId });
      return local;
    };

    socket.e2eePublicKey = async function e2eePublicKeyV216(uid, requestedKeyId = '') {
      if (!uid) return null;
      let keyId = String(requestedKeyId || '');
      if (!keyId) {
        const parent = await getDoc(doc(this.db, 'e2eeKeys', uid));
        if (!parent.exists()) return null;
        keyId = String(parent.data()?.currentKeyId || '');
      }
      if (!keyId) return null;
      const cacheKey = `${uid}:${keyId}`;
      if (this.__bananaE2EEKeyCache.has(cacheKey)) return this.__bananaE2EEKeyCache.get(cacheKey);
      const snap = await getDoc(doc(this.db, 'e2eeKeys', uid, 'keys', keyId));
      if (!snap.exists()) return null;
      const data = snap.data() || {};
      if (data.keyId !== keyId || data.algorithm !== 'X25519' || typeof data.publicKey !== 'string') return null;
      const row = { keyId, publicKey: data.publicKey, algorithm: data.algorithm };
      this.__bananaE2EEKeyCache.set(cacheKey, row);
      return row;
    };

    socket.decryptDmV216 = async function decryptDmV216(snap) {
      const d = snap.data() || {};
      if (!d.e2ee || Number(d.e2ee.version) !== 1) return legacyDm(snap);
      const message = {
        id: snap.id,
        fromId: d.fromId || '',
        toId: d.toId || '',
        text: '',
        at: millis(d.createdAt) || now(),
        editedAt: millis(d.editedAt) || null,
        replyToId: d.replyToId || null,
        reactions: d.reactions || {},
        e2ee: true,
        decryptionFailed: false
      };
      try {
        if (!this.__bananaE2EEReady) await this.ensureE2EEIdentity();
        const mine = message.fromId === this.user.uid;
        const peerId = mine ? message.toId : message.fromId;
        const peerKeyId = mine ? d.e2ee.recipientKeyId : d.e2ee.senderKeyId;
        const peerKey = await this.e2eePublicKey(peerId, peerKeyId);
        if (!peerKey) throw new Error('Chave pública do contato não encontrada.');
        message.text = await window.BananaE2EE.decrypt({
          uid: this.user.uid,
          peerPublicKey: peerKey.publicKey,
          envelope: d.e2ee,
          context: {
            threadId: pairId(message.fromId, message.toId),
            messageId: snap.id,
            fromId: message.fromId,
            toId: message.toId
          }
        });
      } catch (error) {
        console.warn('Banana Cord E2EE decrypt:', error?.message || error);
        message.text = '🔒 Não foi possível descriptografar esta mensagem neste dispositivo.';
        message.decryptionFailed = true;
      }
      return message;
    };

    const startBase = socket.start.bind(socket);
    socket.start = async function startV216(...args) {
      try {
        await this.ensureE2EEIdentity();
      } catch (error) {
        this.__bananaE2EEReady = false;
        this.receive('dm:e2ee-status', { available: false, reason: error?.message || String(error) });
        console.warn('Banana Cord E2EE init:', error?.message || error);
      }
      return startBase(...args);
    };

    socket.watchDmThreads = function watchDmThreadsV216() {
      if (this.dmThreadsCleanup) return;
      const q = query(collection(this.db, 'dmThreads'), where('participants', 'array-contains', this.user.uid));
      this.dmThreadsCleanup = onSnapshot(q, async snap => {
        const conversations = [];
        for (const thread of snap.docs) {
          const data = thread.data() || {};
          const peerId = (data.participants || []).find(x => x !== this.user.uid);
          if (!peerId) continue;
          const user = await this.publicUser(peerId);
          if (!user) continue;
          const last = data.lastMessage || null;
          const lastMessage = last?.e2ee
            ? { ...last, text: '🔒 Mensagem criptografada', e2ee: true }
            : last;
          conversations.push({ user, lastMessage });
        }
        conversations.sort((a, b) => Number(b.lastMessage?.at || 0) - Number(a.lastMessage?.at || 0));
        this.receive('dm:conversations', { conversations });
      }, error => this.receive('app:error', this.friendly(error)));
      this.cleanup.push(this.dmThreadsCleanup);
    };

    socket.watchDm = async function watchDmV216(peerId) {
      if (!(await this.canDm(peerId))) throw new Error('Essa conversa privada não está disponível.');
      if (!this.__bananaE2EEReady) await this.ensureE2EEIdentity();
      const peerCurrentKey = await this.e2eePublicKey(peerId);
      this.receive('dm:e2ee-status', {
        available: !!peerCurrentKey,
        userId: peerId,
        reason: peerCurrentKey ? '' : 'O contato ainda não publicou uma chave de criptografia.'
      });
      const tid = pairId(this.user.uid, peerId);
      this.dmCleanup.get(peerId)?.();
      let first = true;
      const q = query(collection(this.db, 'dmThreads', tid, 'messages'), orderBy('createdAt', 'asc'), limit(250));
      const off = onSnapshot(q, async snap => {
        const user = await this.publicUser(peerId);
        if (first) {
          first = false;
          const messages = await Promise.all(snap.docs.map(row => this.decryptDmV216(row)));
          this.receive('dm:list', { user, messages });
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

    socket.sendDm = async function sendDmV216(payload = {}) {
      const peerId = String(payload.userId || '');
      const text = String(payload.text || '').trim().slice(0, 2000);
      if (!text) return;
      if (!(await this.canDm(peerId))) throw new Error('Essa conversa privada não está disponível.');
      if (!this.__bananaE2EEReady) await this.ensureE2EEIdentity();
      const peerKey = await this.e2eePublicKey(peerId);
      if (!peerKey) throw new Error('Seu amigo precisa atualizar para o Banana Cord V2.0.16 e abrir o aplicativo antes de receber mensagens criptografadas.');

      const tid = pairId(this.user.uid, peerId);
      const messageRef = doc(collection(this.db, 'dmThreads', tid, 'messages'));
      const at = now();
      const envelope = await window.BananaE2EE.encrypt({
        uid: this.user.uid,
        peerPublicKey: peerKey.publicKey,
        peerKeyId: peerKey.keyId,
        text,
        context: {
          threadId: tid,
          messageId: messageRef.id,
          fromId: this.user.uid,
          toId: peerId
        }
      });

      const batch = writeBatch(this.db);
      batch.set(doc(this.db, 'dmThreads', tid), {
        participants: [this.user.uid, peerId].sort(),
        updatedAt: serverTimestamp(),
        lastMessage: { fromId: this.user.uid, toId: peerId, at, e2ee: true }
      }, { merge: true });
      batch.set(messageRef, {
        fromId: this.user.uid,
        toId: peerId,
        e2ee: envelope,
        createdAt: serverTimestamp(),
        editedAt: null,
        replyToId: payload.replyToId || null,
        reactions: {}
      });
      await batch.commit();
    };

    const editDmBase = socket.editDm.bind(socket);
    socket.editDm = async function editDmV216(payload = {}) {
      const peerId = String(payload.userId || '');
      const tid = pairId(this.user.uid, peerId);
      const messageRef = doc(this.db, 'dmThreads', tid, 'messages', payload.messageId);
      const snap = await getDoc(messageRef);
      if (!snap.exists() || snap.data().fromId !== this.user.uid) throw new Error('Você só pode editar suas próprias mensagens.');
      if (!snap.data().e2ee) return editDmBase(payload);
      const text = String(payload.text || '').trim().slice(0, 2000);
      if (!text) return;
      if (!(await this.canDm(peerId))) throw new Error('Essa conversa privada não está disponível.');
      if (!this.__bananaE2EEReady) await this.ensureE2EEIdentity();
      const peerKey = await this.e2eePublicKey(peerId);
      if (!peerKey) throw new Error('A chave de criptografia do seu amigo não está disponível.');
      const envelope = await window.BananaE2EE.encrypt({
        uid: this.user.uid,
        peerPublicKey: peerKey.publicKey,
        peerKeyId: peerKey.keyId,
        text,
        context: {
          threadId: tid,
          messageId: messageRef.id,
          fromId: this.user.uid,
          toId: peerId
        }
      });
      await updateDoc(messageRef, { e2ee: envelope, editedAt: serverTimestamp() });
    };

    return true;
  }

  if (window.BananaLegacy?.attachSocket) {
    const previousAttach = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV216(socket, user) {
      patchSocket(socket);
      return previousAttach(socket, user);
    };
  }
  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV216PatchCloudSocket = patchSocket;
})();
