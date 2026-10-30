/* Banana Cord V2.0.10 server deletion UI fix.
 * Replaces the renderer-native confirmation dialog with an in-app modal.
 */
(() => {
  if (window.__bananaV210ServerDeleteUiFix) return;
  window.__bananaV210ServerDeleteUiFix = true;

  let contextServerId = null;

  function closeMenu() {
    document.querySelector('.v1-context-menu')?.remove();
  }

  function openDeleteModal(server) {
    if (!server || !state?.socket) return;
    const safeName = escapeHtml(server.name || 'Servidor');
    openModal(`
      <h2>Excluir servidor</h2>
      <p>Esta ação é permanente. Para excluir <b>${safeName}</b>, digite o nome do servidor abaixo.</p>
      <label>Nome do servidor</label>
      <input id="v210DeleteServerName" maxlength="40" autocomplete="off" placeholder="${safeName}">
      <div class="cloud-actions" style="margin-top:14px">
        <button id="v210DeleteServerConfirm" class="action danger" type="button" disabled>Excluir definitivamente</button>
        <button id="v210DeleteServerCancel" type="button">Cancelar</button>
      </div>
      <div id="v210DeleteServerError" class="cloud-error hidden" style="margin-top:10px"></div>
    `);

    const input = document.getElementById('v210DeleteServerName');
    const confirmButton = document.getElementById('v210DeleteServerConfirm');
    const cancelButton = document.getElementById('v210DeleteServerCancel');
    const error = document.getElementById('v210DeleteServerError');

    const refresh = () => {
      if (confirmButton) confirmButton.disabled = String(input?.value || '') !== String(server.name || '');
      error?.classList.add('hidden');
    };
    input?.addEventListener('input', refresh);
    input?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && confirmButton && !confirmButton.disabled) confirmButton.click();
    });
    cancelButton?.addEventListener('click', closeModal);
    confirmButton?.addEventListener('click', () => {
      if (String(input?.value || '') !== String(server.name || '')) {
        if (error) {
          error.textContent = 'Digite exatamente o nome do servidor.';
          error.classList.remove('hidden');
        }
        return;
      }
      confirmButton.disabled = true;
      confirmButton.textContent = 'Excluindo…';
      state.socket.emit('server:delete', { serverId: server.id });
      closeModal();
      toast('Excluindo servidor…', 2500);
    });
    queueMicrotask(() => input?.focus());
  }

  document.addEventListener('contextmenu', event => {
    const icon = event.target?.closest?.('.server-icon[data-server-id]');
    if (icon?.dataset?.serverId) contextServerId = icon.dataset.serverId;
  }, true);

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('.v1-menu-item');
    if (!button) return;
    const label = button.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!label.includes('Excluir servidor')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeMenu();

    const server = (state?.servers || []).find(item => item.id === contextServerId)
      || state?.selectedServer
      || null;
    if (!server) return toast('Não consegui identificar o servidor para excluir.', 4000);
    const role = roleFor(state.user?.id, server);
    if (role !== 'owner') return toast('Só o dono pode excluir o servidor.', 3500);
    openDeleteModal(server);
  }, true);
})();
