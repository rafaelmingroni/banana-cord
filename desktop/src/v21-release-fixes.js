/* Banana Cord 2.1 — final integration guards. */
(() => {
  if (window.__bananaV21ReleaseFixes) return;
  window.__bananaV21ReleaseFixes = true;

  const ROLE_RANK = { member:0, moderator:1, admin:2, owner:3 };
  const tr = (key, vars) => window.BananaI18n?.t?.(key, vars) || key;
  let replyState = null;
  let lastContextMessage = null;

  // V2.0.14 fixed an important Private-mode regression: global voice/media
  // updates can call renderChannels while the user is in DMs. V2.1 replaces
  // the server channel renderer, so preserve that guard at the final layer.
  const renderChannelsBase = renderChannels;
  renderChannels = function renderChannelsV21PrivateGuard(...args) {
    if (state.viewMode === 'dm') {
      renderDmSidebar();
      return;
    }
    return renderChannelsBase(...args);
  };

  function currentMessage(messageId, kind) {
    if (kind === 'dm') return (state.dmMessages.get(state.activeDmUserId) || []).find(m => m.id === messageId) || null;
    return (state.messagesByChannel.get(state.selectedChannel?.id) || []).find(m => m.id === messageId) || null;
  }

  // Keep a second, final-layer reply pointer. The legacy app registered its
  // submit listener before V2.1, so this lets the document capture listener
  // route replies before a legacy plain-message send can consume the form.
  document.addEventListener('contextmenu', event => {
    const row = event.target.closest?.('.message[data-message-id]');
    if (row) lastContextMessage = { messageId:row.dataset.messageId, kind:row.dataset.messageKind };
  }, true);

  document.addEventListener('click', event => {
    const direct = event.target.closest?.('[data-v21-action="reply"]');
    if (direct) {
      replyState = { messageId:direct.dataset.messageId, kind:direct.dataset.messageKind };
      return;
    }
    const contextReply = event.target.closest?.('.v21-context-menu [data-action="reply"]');
    if (contextReply && lastContextMessage) {
      replyState = { ...lastContextMessage };
      return;
    }
    if (event.target.closest?.('#v21ReplyBar button')) replyState = null;
  }, true);

  function closeReplyBar() {
    replyState = null;
    const cancel = document.querySelector('#v21ReplyBar button');
    if (cancel) cancel.click();
  }

  function commandHelp() {
    openModal(`<div><h2>${escapeHtml(tr('commands.title'))}</h2><div class="v21-choice-grid"><div class="v21-choice"><b>/clear</b><span>${escapeHtml(tr('commands.clear'))}</span></div><div class="v21-choice"><b>/help</b><span>${escapeHtml(tr('commands.help'))}</span></div><div class="v21-choice"><b>/call</b><span>${escapeHtml(tr('commands.call'))}</span></div><div class="v21-choice"><b>/mute</b><span>${escapeHtml(tr('commands.mute'))}</span></div><div class="v21-choice"><b>/deafen</b><span>${escapeHtml(tr('commands.deafen'))}</span></div><div class="v21-choice"><b>/status</b><span>${escapeHtml(tr('commands.status'))}</span></div></div><p><small>/clear 20 · /clear mine · /clear all<br>/status online · /status away · /status busy</small></p></div>`);
  }

  function confirmClear(execute) {
    openModal(`<div class="v21-confirm"><h2>${escapeHtml(tr('clear.confirmTitle'))}</h2><p>${escapeHtml(tr('clear.confirmBody'))}</p><div class="v21-confirm-actions"><button id="v21ReleaseClearCancel" class="secondary">${escapeHtml(tr('cancel'))}</button><button id="v21ReleaseClearOk" class="danger-action">${escapeHtml(tr('confirm'))}</button></div></div>`);
    document.getElementById('v21ReleaseClearCancel').onclick = closeModal;
    document.getElementById('v21ReleaseClearOk').onclick = () => { closeModal(); execute(); };
  }

  function clearMessages(arg = '') {
    const dm = state.viewMode === 'dm' && !!state.activeDmUserId;
    const server = state.viewMode === 'server' && state.selectedServer && state.selectedChannel?.type === 'text';
    if (!dm && !server) return;
    const lower = String(arg || '').trim().toLowerCase();
    let amount = 20;
    if (/^\d+$/.test(lower)) amount = Math.max(1, Math.min(100, Number(lower)));
    if (lower === 'mine' || lower === 'all') amount = 100;
    const moderator = server && (ROLE_RANK[currentRole()] || 0) >= ROLE_RANK.moderator;
    const mode = server && moderator && lower !== 'mine' ? 'all' : 'mine';
    const execute = () => {
      const event = dm ? 'dm:clear' : 'messages:clear';
      const payload = dm
        ? { userId:state.activeDmUserId, amount }
        : { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, amount, mode };
      state.socket?.emit(event, payload, result => {
        if (result?.ok === false) return toast(result.message || 'Não foi possível limpar as mensagens.', 4200);
        toast(tr('clear.done', { count:result?.count || 0 }), 3200);
      });
    };
    if (lower === 'all') confirmClear(execute); else execute();
  }

  function setStatus(arg) {
    const aliases = {
      online:'online', disponivel:'online', disponible:'online', enlinea:'online', 'en-línea':'online',
      away:'away', ausente:'away',
      busy:'busy', ocupado:'busy'
    };
    const next = aliases[String(arg || '').trim().toLowerCase()];
    if (!next) return toast('/status online | away | busy', 3000);
    state.ui.status = next;
    savePrefs();
    state.socket?.emit('profile:update', { status:next });
  }

  function executeCommand(raw) {
    const [name, ...args] = String(raw || '').trim().split(/\s+/);
    const arg = args.join(' ');
    switch (String(name || '').toLowerCase()) {
      case '/clear': clearMessages(arg); break;
      case '/help': commandHelp(); break;
      case '/call':
        if (state.viewMode !== 'dm' || !state.activeDmUserId) toast('Abra uma conversa privada para iniciar uma chamada.', 3200);
        else document.getElementById('v212DmCallBtn')?.click();
        break;
      case '/mute': toggleMute(); break;
      case '/deafen': toggleDeafen(); break;
      case '/status': setStatus(arg); break;
      default: toast('Comando desconhecido. Digite /help.', 2800);
    }
  }

  // Capture at document level: ancestors run before the form's legacy target
  // listener. This guarantees slash commands and replies never leak into chat as
  // literal text, even though the old renderer is still kept for compatibility.
  document.addEventListener('submit', event => {
    if (event.target !== els.messageForm) return;
    const raw = String(els.messageInput?.value || '').trim();
    if (raw.startsWith('/')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      els.messageInput.value = '';
      document.getElementById('v21CommandMenu')?.classList.add('hidden');
      executeCommand(raw);
      return;
    }
    if (!raw || !replyState) return;
    const target = currentMessage(replyState.messageId, replyState.kind);
    if (!target) { closeReplyBar(); return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (replyState.kind === 'dm' && state.viewMode === 'dm' && state.activeDmUserId) {
      state.socket?.emit('dm:send', { userId:state.activeDmUserId, text:raw, replyToId:target.id });
      els.messageInput.value = '';
      closeReplyBar();
      return;
    }
    if (replyState.kind === 'server' && state.viewMode === 'server' && state.selectedServer && state.selectedChannel?.type === 'text') {
      state.socket?.emit('message:send', { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, text:raw, replyToId:target.id });
      els.messageInput.value = '';
      closeReplyBar();
    }
  }, true);
})();
