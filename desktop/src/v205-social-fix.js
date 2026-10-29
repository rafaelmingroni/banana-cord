/* Banana Cord V2.0.6 social/DM permission fixes + user search. */
(() => {
  if (window.__bananaV205SocialFix) return;
  window.__bananaV205SocialFix = true;

  const emptyRelation = () => ({ exists: () => false, data: () => undefined });
  const pairId = (a, b) => [String(a), String(b)].sort().join('_');

  async function patchSocket(socket) {
    if (!socket || socket.__bananaV205SocialPatched) return false;
    socket.__bananaV205SocialPatched = true;

    const {
      collection, doc, getDocs, setDoc, serverTimestamp,
      query: fsQuery, where, limit
    } = require('firebase/firestore');

    // A direct getDoc() on an absent relationship is denied by the current rules
    // because the read rule inspects resource.data.participants. Querying the
    // caller's own relationship set is rule-compatible and private to that user.
    socket.relation = async function relationV205(otherUid) {
      const rid = pairId(this.user.uid, otherUid);
      const q = fsQuery(
        collection(this.db, 'relationships'),
        where('participants', 'array-contains', this.user.uid)
      );
      const snap = await getDocs(q);
      return snap.docs.find(row => row.id === rid) || emptyRelation();
    };

    socket.friendRequest = async function friendRequestV205(otherUid) {
      if (!otherUid || otherUid === this.user.uid) return;
      const relation = await this.relation(otherUid);
      if (relation.exists()) {
        const data = relation.data() || {};
        if (data.status === 'blocked') throw new Error('Não é possível enviar solicitação para este usuário.');
        if (data.status === 'friends') throw new Error('Vocês já são amigos.');
        if (data.status === 'pending') throw new Error(data.requestedBy === this.user.uid ? 'Solicitação de amizade já enviada.' : 'Esse usuário já enviou uma solicitação para você.');
      }
      await setDoc(doc(this.db, 'relationships', pairId(this.user.uid, otherUid)), {
        participants: [this.user.uid, otherUid].sort(),
        status: 'pending',
        requestedBy: this.user.uid,
        updatedAt: serverTimestamp()
      });
      await this.emitSocial().catch(() => {});
    };

    // Opening a brand-new DM used to attach a messages listener before the parent
    // dmThread existed. The rules intentionally require the caller to be listed in
    // that parent document, so the first listener was rejected with permission-denied.
    // Create/merge the parent thread first, then reuse the mature original watcher.
    if (typeof socket.watchDm === 'function') {
      const originalWatchDm = socket.watchDm.bind(socket);
      socket.watchDm = async function watchDmV206(peerId) {
        if (!(await this.canDm(peerId))) throw new Error('Essa conversa privada não está disponível.');
        const tid = pairId(this.user.uid, peerId);
        await setDoc(doc(this.db, 'dmThreads', tid), {
          participants: [this.user.uid, peerId].sort(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        return originalWatchDm(peerId);
      };
    }

    async function refreshSearchName() {
      const name = String(socket.user?.displayName || '').trim();
      if (!name) return;
      await setDoc(doc(socket.db, 'publicProfiles', socket.user.uid), {
        searchName: name.toLocaleLowerCase('pt-BR')
      }, { merge: true });
    }
    refreshSearchName().catch(() => {});

    if (typeof socket.updateProfile === 'function') {
      const originalUpdateProfile = socket.updateProfile.bind(socket);
      socket.updateProfile = async function updateProfileV205(payload) {
        await originalUpdateProfile(payload);
        const name = String(payload?.name || this.user?.displayName || '').trim();
        if (name) {
          await setDoc(doc(this.db, 'publicProfiles', this.user.uid), {
            searchName: name.toLocaleLowerCase('pt-BR')
          }, { merge: true });
        }
      };
    }

    socket.searchUsers = async function searchUsersV205(text) {
      const raw = String(text || '').trim().slice(0, 32);
      if (!raw) return [];
      const normalized = raw.toLocaleLowerCase('pt-BR');
      let snap = await getDocs(fsQuery(
        collection(this.db, 'publicProfiles'),
        where('searchName', '==', normalized),
        limit(20)
      ));
      if (snap.empty) {
        snap = await getDocs(fsQuery(
          collection(this.db, 'publicProfiles'),
          where('displayName', '==', raw),
          limit(20)
        ));
      }
      const users = [];
      for (const row of snap.docs) {
        if (row.id === this.user.uid) continue;
        const user = await this.publicUser(row.id).catch(() => null);
        if (user) users.push(user);
      }
      return users;
    };

    const originalHandle = socket.handle.bind(socket);
    socket.handle = async function handleV205(event, payload = {}, ack) {
      if (event === 'friend:search') {
        const users = await this.searchUsers(payload.query);
        ack?.({ ok: true, users });
        return;
      }
      if (event === 'friend:request') {
        await this.friendRequest(payload.userId);
        ack?.({ ok: true });
        return;
      }
      return originalHandle(event, payload, ack);
    };

    return true;
  }

  window.BananaV205PatchSocialSocket = patchSocket;
  patchSocket(window.BananaCloudSocket);

  // Cover login/relogin even if the user sits on the auth screen for a long time.
  if (window.BananaLegacy?.attachSocket) {
    const originalAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketSocialV205(socket, user) {
      patchSocket(socket);
      return originalAttachSocket(socket, user);
    };
  }
})();
