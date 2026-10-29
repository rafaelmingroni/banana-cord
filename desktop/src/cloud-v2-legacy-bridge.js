/* Banana Cord v2 Cloud — ponte para reutilizar integralmente a UI/motor da v1.2.1.
 * Não cria uma segunda interface. O Firebase entra como transporte de dados.
 */
(() => {
  window.BananaCloudMode = true;

  function attachSocket(socket, user) {
    if (!socket) throw new Error('Socket Banana Cloud inválido.');
    state.socket = socket;
    state.serverUrl = 'banana-cloud://firebase';
    state.publicHostUrl = '';
    state.isHost = false;
    state.pendingInvite = '';
    if (user?.displayName && els.setupName) els.setupName.value = user.displayName;
    bindSocket(socket);
    setConnection(true);
    window.BananaCloudSocket = socket;
  }

  // No modo Cloud o + deve continuar usando o modal maduro da v1.2.1,
  // porém sem qualquer referência a "mesmo host".
  els.addServerBtn?.addEventListener('click', event => {
    if (!window.BananaCloud?.ready) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openModal(`
      <div class="simple-modal-head">
        <h2>Servidor</h2>
        <p>Crie um servidor permanente no Banana Cloud ou entre usando um código de convite.</p>
      </div>
      <label>Nome do novo servidor</label>
      <input id="newServerName" maxlength="40" placeholder="Banana Gang">
      <button id="createServerNow" class="action">Criar servidor</button>
      <div class="divider"><span>ou</span></div>
      <label>Código de convite</label>
      <input id="joinCode" maxlength="20" placeholder="ABCD-EFGH">
      <button id="joinServerNow" class="secondary">Entrar pelo código</button>`);
  }, true);

  // O handler original de modal da 1.2.1 continua sendo usado e envia
  // server:create/server:join para o socket virtual do Cloud.

  // Na V2, "Desconectar" deve encerrar a conta, e não apenas recarregar.
  const modalObserver = new MutationObserver(() => {
    if (!window.BananaCloud?.ready) return;
    const disconnect = document.getElementById('disconnectNow');
    if (disconnect && disconnect.dataset.cloudLogout !== '1') {
      disconnect.dataset.cloudLogout = '1';
      disconnect.textContent = 'Sair da conta';
      disconnect.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.BananaCloud?.signOut?.();
      }, true);
    }
    const foot = document.querySelector('.settings-nav-foot');
    if (foot && foot.textContent !== 'v2 Cloud Preview') foot.textContent = 'v2 Cloud Preview';
    const version = document.querySelector('.version-label');
    if (version && version.textContent !== 'Banana Cord v2 Cloud Preview') version.textContent = 'Banana Cord v2 Cloud Preview';
  });
  if (els.modalBody) modalObserver.observe(els.modalBody, { childList: true, subtree: true });

  window.BananaLegacy = {
    attachSocket,
    get state() { return state; },
    get els() { return els; },
    showEmpty: () => showEmpty(),
    toast: (...args) => toast(...args),
    openModal: html => openModal(html),
    closeModal: () => closeModal(),
    setConnection: ok => setConnection(ok)
  };
})();
