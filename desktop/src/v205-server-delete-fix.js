/* Banana Cord V2.0.5 server deletion fix. */
(() => {
  if (window.__bananaV205ServerDeleteFix) return;
  window.__bananaV205ServerDeleteFix = true;

  function patchSocket(socket) {
    if (!socket || socket.__bananaV205ServerDeletePatched || typeof socket.deleteServer !== 'function') return false;
    socket.__bananaV205ServerDeletePatched = true;
    const originalDeleteServer = socket.deleteServer.bind(socket);

    socket.deleteServer = async function deleteServerV205(serverId) {
      const { collection, getDocs, writeBatch } = require('firebase/firestore');

      const role = await this.role(serverId);
      if (role !== 'owner') throw new Error('Só o dono pode excluir o servidor.');

      // The original V2 flow removed the owner's member record before removing
      // channels. Firestore channel rules require the owner to still be a member,
      // so deletion stopped with permission-denied. Remove messages/channels first,
      // while the owner still has full server permissions, then let the original
      // cleanup remove members, refs, invite and finally the server document.
      const channels = await getDocs(collection(this.db, 'servers', serverId, 'channels'));
      for (const channel of channels.docs) {
        if (channel.data().type === 'text') {
          const messages = await getDocs(collection(this.db, 'servers', serverId, 'channels', channel.id, 'messages'));
          for (let i = 0; i < messages.docs.length; i += 400) {
            const batch = writeBatch(this.db);
            messages.docs.slice(i, i + 400).forEach(message => batch.delete(message.ref));
            await batch.commit();
          }
        }
      }
      for (let i = 0; i < channels.docs.length; i += 400) {
        const batch = writeBatch(this.db);
        channels.docs.slice(i, i + 400).forEach(channel => batch.delete(channel.ref));
        await batch.commit();
      }

      return originalDeleteServer(serverId);
    };
    return true;
  }

  // Patch an already attached Cloud socket.
  patchSocket(window.BananaCloudSocket);

  // More importantly, patch every future socket before the legacy UI starts using it.
  // This also covers users who stay on the login screen for a long time before signing in.
  if (window.BananaLegacy?.attachSocket) {
    const originalAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV205(socket, user) {
      patchSocket(socket);
      return originalAttachSocket(socket, user);
    };
  }
})();
