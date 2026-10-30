/* Banana Cord V2.0.11 — native Cloud social/DM fix.
 * Bundled into cloud-v2-all.browser.js so every Firestore reference comes from
 * the same Firebase runtime used by cloud-v2-socket.js.
 */
(() => {
  const {
    collection, doc, getDocs, setDoc, serverTimestamp,
    query: fsQuery, where, limit
  } = require('firebase/firestore');

  const pairId = (a, b) => [String(a), String(b)].sort().join('_');
  const emptyRelation = () => ({ exists: () => false, data: () => undefined });

  function patchSocket(socket) {
    if (!socket || socket.__bananaV211SocialPatched) return false;
    socket.__bananaV211SocialPatched = true;

    // Reading a relationship document that does not exist is denied by the rules,
    // because the read rule inspects resource.data.participants. Query only rows
    // that already belong to the signed-in user, then locate the pair locally.
    socket.relation = async function relationV211(otherUid) {
      if (!otherUid) return emptyRelation();
      const rid = pairId(this.user.uid, otherUid);
      const snap = await getDocs(fsQuery(
        collection(this.db, 'relationships'),
        where('participants', 'array-contains', this.user.uid)
      ));
      return snap.docs.find(row => row.id === rid) || emptyRelation();
    };

    // Friend requests are account-level in V2 and do not require a shared server.
    socket.friendRequest = async function friendRequestV211(otherUid) {
      if (!otherUid || otherUid === this.user.uid) return;
      const relation = await this.relation(otherUid);
      if (relation.exists()) {
        const data = relation.data() || {};
        if (data.status === 'blocked') throw new Error('Não é possível enviar solicitação para este usuário.');
        if (data.status === 'friends') throw new Error('Vocês já são amigos.');
        if (data.status === 'pending') {
          throw new Error(data.requestedBy === this.user.uid
            ? 'Solicitação de amizade já enviada.'
            : 'Esse usuário já enviou uma solicitação para você.');
        }
      }
      await setDoc(doc(this.db, 'relationships', pairId(this.user.uid, otherUid)), {
        participants: [this.user.uid, otherUid].sort(),
        status: 'pending',
        requestedBy: this.user.uid,
        updatedAt: serverTimestamp()
      });
      await this.emitSocial().catch(() => {});
    };

    // Create/merge the DM parent before attaching the messages listener. The rules
    // require the caller to be a participant of the parent thread before reads.
    if (typeof socket.watchDm === 'function') {
      const originalWatchDm = socket.watchDm.bind(socket);
      socket.watchDm = async function watchDmV211(peerId) {
        if (!(await this.canDm(peerId))) throw new Error('Essa conversa privada não está disponível.');
        const tid = pairId(this.user.uid, peerId);
        await setDoc(doc(this.db, 'dmThreads', tid), {
          participants: [this.user.uid, peerId].sort(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        return originalWatchDm(peerId);
      };
    }

    // Keep a normalized search key on every public profile so users can be found
    // without sharing a server and without case-sensitive display-name matching.
    if (typeof socket.ensurePublicProfile === 'function') {
      const originalEnsurePublicProfile = socket.ensurePublicProfile.bind(socket);
      socket.ensurePublicProfile = async function ensurePublicProfileV211() {
        await originalEnsurePublicProfile();
        const name = String(this.user?.displayName || '').trim();
        if (name) {
          await setDoc(doc(this.db, 'publicProfiles', this.user.uid), {
            searchName: name.toLocaleLowerCase('pt-BR')
          }, { merge: true });
        }
      };
    }

    if (typeof socket.updateProfile === 'function') {
      const originalUpdateProfile = socket.updateProfile.bind(socket);
      socket.updateProfile = async function updateProfileV211(payload) {
        await originalUpdateProfile(payload);
        const name = String(payload?.name || this.user?.displayName || '').trim();
        if (name) {
          await setDoc(doc(this.db, 'publicProfiles', this.user.uid), {
            searchName: name.toLocaleLowerCase('pt-BR')
          }, { merge: true });
        }
      };
    }

    socket.searchUsers = async function searchUsersV211(text) {
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
    socket.handle = async function handleV211(event, payload = {}, ack) {
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

  // cloud-v2-socket.js creates the socket after modules are evaluated. Patch the
  // socket before the legacy UI receives it, while all code is still in one bundle.
  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV211(socket, user) {
      patchSocket(socket);
      return previousAttachSocket(socket, user);
    };
  }

  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV211PatchSocialSocket = patchSocket;
})();
