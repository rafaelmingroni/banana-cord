/* Banana Cord V2.0.16+ — private-message E2EE indicators. */
(() => {
  if (window.__bananaV216E2EEUi) return;
  window.__bananaV216E2EEUi = true;

  state.e2ee = state.e2ee || { localAvailable: null, byUser: new Map() };

  const style = document.createElement('style');
  style.textContent = `
    .v216-e2ee-banner{display:flex;align-items:center;gap:8px;margin:8px 10px 2px;padding:8px 10px;border:1px solid #36523f;border-radius:9px;background:#18231c;color:#a9e9ba;font-size:10px;font-weight:800}
    .v216-e2ee-banner.wait{border-color:#665b2a;background:#282313;color:#f4d86a}
    .v216-e2ee-banner.fail{border-color:#64363a;background:#2a181b;color:#ff9ea7}
    .v216-e2ee-banner small{font-size:9px;font-weight:600;opacity:.78}
    .v216-e2ee-failed .msg-text{color:#d7a2a7;font-style:italic}
  `;
  document.head.appendChild(style);

  function statusFor(userId) {
    return state.e2ee.byUser.get(userId) || null;
  }

  function applyHeaderStatus() {
    if (state.viewMode !== 'dm' || !state.activeDmUserId) return;
    const status = statusFor(state.activeDmUserId);
    if (!status) {
      els.channelDesc.textContent = '🔐 Preparando proteção da conversa…';
      return;
    }
    if (status.available) {
      els.channelDesc.textContent = '🔒 Conversa protegida';
    } else {
      els.channelDesc.textContent = '⚠ Proteção aguardando o contato';
    }
  }

  function decorateMessages() {
    if (state.viewMode !== 'dm' || !state.activeDmUserId || !els.messages) return;
    els.messages.querySelector('.v216-e2ee-banner')?.remove();
    const status = statusFor(state.activeDmUserId);
    const banner = document.createElement('div');
    banner.className = 'v216-e2ee-banner';
    if (!status) {
      banner.classList.add('wait');
      banner.innerHTML = '<span>🔐 Preparando proteção da conversa…</span>';
    } else if (status.available) {
      banner.innerHTML = '<span>🔒 Mensagens protegidas com criptografia ponta a ponta</span><small>Só você e seu contato conseguem ler as novas mensagens desta conversa.</small>';
    } else {
      banner.classList.add('wait');
      banner.innerHTML = '<span>⚠ Proteção ainda não disponível</span><small>Seu contato precisa abrir uma versão atual do Banana Cord para ativar a proteção.</small>';
    }
    els.messages.prepend(banner);

    const messages = state.dmMessages.get(state.activeDmUserId) || [];
    const rows = [...els.messages.querySelectorAll('.dm-message')];
    let rowIndex = 0;
    for (const message of messages) {
      const row = rows[rowIndex++];
      if (row && message?.decryptionFailed) row.classList.add('v216-e2ee-failed');
    }

    const empty = els.messages.querySelector('.dm-conversation-empty');
    if (empty && status?.available) {
      empty.innerHTML = '<b>Comece a conversa 👋</b><span>🔒 As novas mensagens desta conversa ficam protegidas de ponta a ponta.</span>';
    }
  }

  const renderDmMessagesBase = renderDmMessages;
  renderDmMessages = function renderDmMessagesV216(...args) {
    const result = renderDmMessagesBase(...args);
    decorateMessages();
    applyHeaderStatus();
    return result;
  };

  const startDmBase = startDm;
  startDm = function startDmV216(userId, user = null) {
    const result = startDmBase(userId, user);
    if (state.viewMode === 'dm' && state.activeDmUserId === userId) {
      els.channelDesc.textContent = '🔐 Preparando proteção da conversa…';
      queueMicrotask(() => { decorateMessages(); applyHeaderStatus(); });
    }
    return result;
  };

  const bindSocketBase = bindSocket;
  bindSocket = function bindSocketV216(socket) {
    bindSocketBase(socket);
    if (!socket || socket.__bananaV216E2EEUiBound) return;
    socket.__bananaV216E2EEUiBound = true;
    socket.on('dm:e2ee-status', payload => {
      if (!payload) return;
      if (payload.userId && payload.userId !== state.user?.id) {
        state.e2ee.byUser.set(payload.userId, payload);
      } else if (!payload.userId || payload.userId === state.user?.id) {
        state.e2ee.localAvailable = payload.available !== false;
      }
      if (payload.userId === state.activeDmUserId || !payload.userId) {
        applyHeaderStatus();
        decorateMessages();
      }
    });
  };
})();
