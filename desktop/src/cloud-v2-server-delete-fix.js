/* Banana Cord V2.0.9 — native Cloud server deletion fix.
 * IMPORTANT: this file is bundled into cloud-v2-all.browser.js so its Firestore
 * functions share the exact same Firebase runtime as cloud-v2-socket.js.
 */
(() => {
  const { collection, getDocs, writeBatch } = require('firebase/firestore');

  function patchSocket(socket) {
    if (!socket || socket.__bananaV209ServerDeletePatched || typeof socket.deleteServer !== 'function') return false;
    socket.__bananaV209ServerDeletePatched = true;

    const originalDeleteServer = socket.deleteServer.bind(socket);
    socket.deleteServer = async function deleteServerV209(serverId) {
      const role = await this.role(serverId);
      if (role !== 'owner') throw new Error('Só o dono pode excluir o servidor.');

      // Firestore channel/message rules require the owner to still be a server member.
      // Remove protected descendants first, then let the original cleanup remove
      // members, user serverRefs, invite and finally the server document.
      const channels = await getDocs(collection(this.db, 'servers', serverId, 'channels'));

      for (const channel of channels.docs) {
        if (channel.data().type !== 'text') continue;
        const messages = await getDocs(collection(this.db, 'servers', serverId, 'channels', channel.id, 'messages'));
        for (let i = 0; i < messages.docs.length; i += 400) {
          const batch = writeBatch(this.db);
          messages.docs.slice(i, i + 400).forEach(message => batch.delete(message.ref));
          await batch.commit();
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

  // cloud-v2-socket.js creates/attaches the socket after this module is evaluated,
  // so patch future sockets before the legacy UI receives them.
  if (window.BananaLegacy?.attachSocket) {
    const previousAttachSocket = window.BananaLegacy.attachSocket;
    window.BananaLegacy.attachSocket = function attachSocketV209(socket, user) {
      patchSocket(socket);
      return previousAttachSocket(socket, user);
    };
  }

  if (window.BananaCloudSocket) patchSocket(window.BananaCloudSocket);
  window.BananaV209PatchServerDelete = patchSocket;
})();
