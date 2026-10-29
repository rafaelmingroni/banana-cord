/* Banana Cord V2 Cloud — ponte para reutilizar integralmente a UI/motor da v1.2.1.
 * Firebase é o transporte nativo. Não existe fluxo de hospedagem na V2.
 */
(() => {
  window.BananaCloudMode = true;
  window.BananaCloudNative = true;

  function attachSocket(socket, user) {
    if (!socket) throw new Error('Socket Banana Cloud inválido.');
    state.socket = socket;
    state.serverUrl = 'banana-cloud://firebase';
    state.publicHostUrl = '';
    state.isHost = false;
    state.pendingInvite = '';
    if (user?.displayName && els.setupName) els.setupName.value = user.displayName;
    els.setup?.classList.add('hidden');
    bindSocket(socket);
    setConnection(true);
    window.BananaCloudSocket = socket;
  }

  async function cloudLogout() {
    try { await window.BananaCloudSocket?.disconnect?.(); } catch (error) { console.warn('Banana Cloud disconnect:', error); }
    try { await window.BananaCloud?.signOut?.(); } catch (error) { console.error('Banana Cloud logout:', error); return toast('Não consegui sair da conta.', 4200); }
    window.BananaCloudSocket = null;
    state.socket = null;
    state.readyOnce = false;
    state.user = null;
    state.servers = [];
    state.selectedServer = null;
    state.selectedChannel = null;
    state.members = new Map();
    state.messagesByChannel = new Map();
    state.voicePresence = new Map();
    setConnection(false);
    els.app?.classList.add('hidden');
    els.setup?.classList.add('hidden');
    closeModal();
  }

  function normalizeCloudModal() {
    if (!window.BananaCloudMode || !els.modalBody) return;

    // O modal original da v1.2.1 é mantido porque seus handlers são maduros;
    // apenas o texto legado de "mesmo host" é convertido para a arquitetura Cloud.
    if (document.getElementById('newServerName')) {
      const head = els.modalBody.querySelector('h2');
      if (head && head.textContent !== 'Servidor') head.textContent = 'Servidor';
      const paragraph = els.modalBody.querySelector('p');
      const desired = 'Crie um servidor permanente no Banana Cloud ou entre usando um código de convite.';
      if (paragraph && paragraph.textContent !== desired) paragraph.textContent = desired;
    }

    const disconnect = document.getElementById('disconnectNow');
    if (disconnect && disconnect.dataset.cloudLogout !== '1') {
      disconnect.dataset.cloudLogout = '1';
      disconnect.textContent = 'Sair da conta';
      disconnect.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        cloudLogout();
      }, true);
    }

    const foot = document.querySelector('.settings-nav-foot');
    if (foot && foot.textContent !== 'v2 Cloud Preview') foot.textContent = 'v2 Cloud Preview';
    const version = document.querySelector('.version-label');
    if (version && version.textContent !== 'Banana Cord v2 Cloud Preview') version.textContent = 'Banana Cord v2 Cloud Preview';
  }

  let modalQueued = false;
  const modalObserver = new MutationObserver(() => {
    if (modalQueued) return;
    modalQueued = true;
    queueMicrotask(() => {
      modalQueued = false;
      normalizeCloudModal();
    });
  });
  if (els.modalBody) modalObserver.observe(els.modalBody, { childList: true, subtree: true });

  // Remove a única mensagem visível restante que falava em armazenamento no PC do host.
  const patchCloudMessageCopy = () => {
    const line = els.messages?.querySelector('.dm-conversation-empty span');
    const desired = 'As mensagens ficam sincronizadas no Banana Cloud.';
    if (line && line.textContent !== desired) line.textContent = desired;
  };
  let messagesQueued = false;
  const messagesObserver = new MutationObserver(() => {
    if (messagesQueued) return;
    messagesQueued = true;
    queueMicrotask(() => { messagesQueued = false; patchCloudMessageCopy(); });
  });
  if (els.messages) messagesObserver.observe(els.messages, { childList: true, subtree: true });

  window.BananaLegacy = {
    attachSocket,
    cloudLogout,
    get state() { return state; },
    get els() { return els; },
    showEmpty: () => showEmpty(),
    toast: (...args) => toast(...args),
    openModal: html => openModal(html),
    closeModal: () => closeModal(),
    setConnection: ok => setConnection(ok)
  };
})();
