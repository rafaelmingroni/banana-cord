/* Banana Cord 2.1 — Social Update renderer. */
(() => {
  if (window.__bananaV21SocialUi) return;
  window.__bananaV21SocialUi = true;

  const { ipcRenderer } = require('electron');
  const i18n = () => window.BananaI18n;
  const t = (key, vars) => i18n()?.t?.(key, vars) || key;
  const ROLE_RANK_V21 = { member:0, moderator:1, admin:2, owner:3 };
  const ROLE_COLORS = { member:'#aeb4bd', moderator:'#53b5df', admin:'#c47cff' };

  let replyTarget = null;
  let contextMenu = null;
  let popover = null;
  let commandMenu = null;
  let commandIndex = 0;
  let systemState = { idleSeconds:0, idleState:'active', activity:null, settings:{ shareActivity:true, autoAwayMinutes:5, startup:{ enabled:false } } };
  let effectiveAutoStatus = '';
  let publishedActivityKey = '__unset__';

  function esc(value) { return escapeHtml(String(value ?? '')); }
  function closeFloating() {
    contextMenu?.remove(); contextMenu = null;
    popover?.remove(); popover = null;
  }

  document.addEventListener('pointerdown', event => {
    if (contextMenu && !contextMenu.contains(event.target)) { contextMenu.remove(); contextMenu = null; }
    if (popover && !popover.contains(event.target) && !event.target.closest?.('[data-v21-popover-anchor]')) { popover.remove(); popover = null; }
  }, true);

  function messageContext() {
    if (state.viewMode === 'dm' && state.activeDmUserId) {
      return { kind:'dm', key:state.activeDmUserId, list:state.dmMessages.get(state.activeDmUserId) || [] };
    }
    if (state.viewMode === 'server' && state.selectedChannel?.type === 'text') {
      return { kind:'server', key:state.selectedChannel.id, list:state.messagesByChannel.get(state.selectedChannel.id) || [] };
    }
    return null;
  }

  function findMessage(messageId, kind = messageContext()?.kind) {
    const ctx = messageContext();
    if (!ctx || ctx.kind !== kind) return null;
    return ctx.list.find(row => row.id === messageId) || null;
  }

  function messageAuthor(message, kind) {
    if (kind === 'dm') {
      const mine = message.fromId === state.user?.id;
      return mine ? state.user : (dmPeer(state.activeDmUserId) || { id:state.activeDmUserId, name:'Amigo' });
    }
    return state.members.get(message.authorId) || { id:message.authorId, name:'Usuário' };
  }

  function canEditMessage(message, kind) {
    return kind === 'dm' ? message.fromId === state.user?.id : message.authorId === state.user?.id;
  }

  function canDeleteMessage(message, kind) {
    if (kind === 'dm') return message.fromId === state.user?.id;
    return message.authorId === state.user?.id || (ROLE_RANK_V21[currentRole()] || 0) >= ROLE_RANK_V21.moderator;
  }

  function addEditedMarker(row, message) {
    if (!message?.editedAt || row.querySelector('.v21-edited')) return;
    const time = row.querySelector('.msg-head small');
    if (!time) return;
    const marker = document.createElement('span');
    marker.className = 'v21-edited';
    marker.textContent = t('edited');
    time.insertAdjacentElement('afterend', marker);
  }

  function addReplyPreview(row, message, kind, list) {
    if (!message?.replyToId || row.querySelector('.v21-reply-preview')) return;
    const target = list.find(item => item.id === message.replyToId);
    if (!target) return;
    const body = row.children[1];
    const head = body?.querySelector('.msg-head');
    if (!body || !head) return;
    const user = messageAuthor(target, kind);
    const preview = document.createElement('div');
    preview.className = 'v21-reply-preview';
    preview.innerHTML = `<b>${esc(user?.name || 'Usuário')}</b><span>${esc(String(target.text || '').slice(0, 120))}</span>`;
    body.insertBefore(preview, head);
  }

  function addReactionPills(row, message, kind) {
    const body = row.children[1];
    if (!body || row.querySelector('.v21-reactions')) return;
    const reactions = message?.reactions || {};
    const entries = Object.entries(reactions).filter(([, ids]) => Array.isArray(ids) && ids.length);
    if (!entries.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'v21-reactions';
    for (const [emoji, ids] of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v21-reaction' + (ids.includes(state.user?.id) ? ' mine' : '');
      button.dataset.v21Action = 'react';
      button.dataset.messageId = message.id;
      button.dataset.messageKind = kind;
      button.dataset.emoji = emoji;
      button.textContent = `${emoji} ${ids.length}`;
      wrap.appendChild(button);
    }
    body.appendChild(wrap);
  }

  function addMessageTools(row, message, kind) {
    if (row.querySelector('.v21-message-tools')) return;
    const tools = document.createElement('div');
    tools.className = 'v21-message-tools';
    const actions = [
      ['reply','↩',t('reply')],
      ['react','👍','👍'],
      ['react','❤️','❤️']
    ];
    if (canEditMessage(message, kind)) actions.push(['edit','✎',t('edit')]);
    actions.push(['more','⋯',t('more')]);
    for (const [action, label, title] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.v21Action = action;
      button.dataset.messageId = message.id;
      button.dataset.messageKind = kind;
      if (action === 'react') button.dataset.emoji = label;
      button.title = title;
      button.textContent = label;
      tools.appendChild(button);
    }
    row.appendChild(tools);
  }

  function decorateMessages(kind) {
    const ctx = messageContext();
    if (!ctx || ctx.kind !== kind || !els.messages) return;
    const selector = kind === 'dm' ? '.message.dm-message' : '.message:not(.dm-message)';
    const rows = [...els.messages.querySelectorAll(selector)];
    ctx.list.forEach((message, index) => {
      const row = rows[index];
      if (!row) return;
      row.dataset.messageId = message.id;
      row.dataset.messageKind = kind;
      row.dataset.mine = String(canEditMessage(message, kind));
      addEditedMarker(row, message);
      addReplyPreview(row, message, kind, ctx.list);
      addReactionPills(row, message, kind);
      addMessageTools(row, message, kind);
    });
  }

  const renderMessagesBase = renderMessages;
  renderMessages = function renderMessagesV21(...args) {
    const result = renderMessagesBase(...args);
    decorateMessages('server');
    return result;
  };

  const renderDmMessagesBase = renderDmMessages;
  renderDmMessages = function renderDmMessagesV21(...args) {
    const result = renderDmMessagesBase(...args);
    decorateMessages('dm');
    return result;
  };

  function updateMessageInState(kind, message, userId = '') {
    if (kind === 'dm') {
      const peerId = userId || state.activeDmUserId;
      if (!peerId) return;
      const list = state.dmMessages.get(peerId) || [];
      const index = list.findIndex(row => row.id === message.id);
      if (index >= 0) list[index] = message;
      else list.push(message);
      state.dmMessages.set(peerId, list);
      if (state.viewMode === 'dm' && state.activeDmUserId === peerId) renderDmMessages();
      return;
    }
    const list = state.messagesByChannel.get(message.channelId) || [];
    const index = list.findIndex(row => row.id === message.id);
    if (index >= 0) list[index] = message;
    else list.push(message);
    state.messagesByChannel.set(message.channelId, list);
    if (state.selectedChannel?.id === message.channelId) renderMessages();
  }

  function deleteMessageFromState(kind, messageId, key) {
    if (kind === 'dm') {
      const peerId = key || state.activeDmUserId;
      const list = state.dmMessages.get(peerId) || [];
      state.dmMessages.set(peerId, list.filter(row => row.id !== messageId));
      if (state.viewMode === 'dm' && state.activeDmUserId === peerId) renderDmMessages();
      return;
    }
    const channelId = key;
    const list = state.messagesByChannel.get(channelId) || [];
    state.messagesByChannel.set(channelId, list.filter(row => row.id !== messageId));
    if (state.selectedChannel?.id === channelId) renderMessages();
  }

  function bindV21Socket(socket) {
    if (!socket || socket.__bananaV21UiBound) return;
    socket.__bananaV21UiBound = true;
    socket.on('message:updated', message => updateMessageInState('server', message));
    socket.on('message:deleted', ({ channelId, messageId }) => deleteMessageFromState('server', messageId, channelId));
    socket.on('dm:updated', ({ userId, message }) => updateMessageInState('dm', message, userId));
    socket.on('dm:deleted', ({ userId, messageId }) => deleteMessageFromState('dm', messageId, userId));
    socket.on('presence:update', user => {
      if (user?.id === state.user?.id) {
        state.user = { ...state.user, ...user };
        renderSelf();
      }
      setTimeout(decorateActivities, 0);
    });
    socket.on('auth:ready', () => setTimeout(syncSystemPresence, 80));
  }

  const bindSocketBase = bindSocket;
  bindSocket = function bindSocketV21(socket) {
    bindSocketBase(socket);
    bindV21Socket(socket);
  };
  if (state.socket) bindV21Socket(state.socket);

  function startInlineEdit(messageId, kind) {
    const message = findMessage(messageId, kind);
    if (!message || !canEditMessage(message, kind)) return;
    const row = els.messages?.querySelector(`.message[data-message-id="${CSS.escape(messageId)}"][data-message-kind="${kind}"]`);
    const text = row?.querySelector('.msg-text');
    if (!row || !text || row.classList.contains('v21-editing')) return;
    row.classList.add('v21-editing');
    text.classList.add('hidden');
    row.querySelector('.v21-message-tools')?.classList.add('hidden');
    const editor = document.createElement('div');
    editor.className = 'v21-inline-edit';
    editor.innerHTML = `<textarea maxlength="2000"></textarea><div class="v21-edit-hint"><b>Enter</b> → ${esc(t('save'))} · <b>Esc</b> → ${esc(t('cancel'))}</div>`;
    text.insertAdjacentElement('afterend', editor);
    const input = editor.querySelector('textarea');
    input.value = message.text || '';
    input.focus(); input.setSelectionRange(input.value.length, input.value.length);
    const cancel = () => {
      editor.remove(); text.classList.remove('hidden'); row.classList.remove('v21-editing'); row.querySelector('.v21-message-tools')?.classList.remove('hidden');
    };
    const save = () => {
      const next = input.value.trim();
      if (!next || next === String(message.text || '').trim()) return cancel();
      if (kind === 'dm') state.socket.emit('dm:edit', { userId:state.activeDmUserId, messageId, text:next });
      else state.socket.emit('message:edit', { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, messageId, text:next });
      cancel();
    };
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); cancel(); }
      else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); save(); }
    });
  }

  function confirmDialog(title, body, confirmLabel, onConfirm, danger = false) {
    openModal(`<div class="v21-confirm"><h2>${esc(title)}</h2><p>${esc(body)}</p><div class="v21-confirm-actions"><button id="v21ConfirmCancel" class="secondary">${esc(t('cancel'))}</button><button id="v21ConfirmOk" class="${danger ? 'danger-action' : 'action'}">${esc(confirmLabel)}</button></div></div>`);
    $('v21ConfirmCancel').onclick = closeModal;
    $('v21ConfirmOk').onclick = () => { closeModal(); onConfirm?.(); };
  }

  function requestDelete(messageId, kind) {
    const message = findMessage(messageId, kind);
    if (!message || !canDeleteMessage(message, kind)) return;
    confirmDialog(t('deleteMessage.title'), t('deleteMessage.body'), t('delete'), () => {
      if (kind === 'dm') state.socket.emit('dm:delete', { userId:state.activeDmUserId, messageId });
      else state.socket.emit('message:delete', { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, messageId });
    }, true);
  }

  function reactMessage(messageId, kind, emoji) {
    if (!['👍','❤️','😂','👎'].includes(emoji)) return;
    if (kind === 'dm') state.socket.emit('dm:react', { userId:state.activeDmUserId, messageId, emoji });
    else state.socket.emit('message:react', { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, messageId, emoji });
  }

  function ensureReplyBar() {
    let bar = document.getElementById('v21ReplyBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'v21ReplyBar';
    bar.className = 'v21-reply-bar hidden';
    bar.innerHTML = '<b></b><span></span><button type="button" title="Cancelar">×</button>';
    els.messageForm?.insertAdjacentElement('beforebegin', bar);
    bar.querySelector('button').onclick = () => setReply(null);
    return bar;
  }

  function setReply(target) {
    replyTarget = target;
    const bar = ensureReplyBar();
    bar.classList.toggle('hidden', !target);
    if (!target) return;
    const user = messageAuthor(target.message, target.kind);
    bar.querySelector('b').textContent = `↩ ${user?.name || 'Usuário'}`;
    bar.querySelector('span').textContent = String(target.message.text || '').slice(0, 180);
    els.messageInput?.focus();
  }

  function showMessageMenu(messageId, kind, x, y) {
    const message = findMessage(messageId, kind);
    if (!message) return;
    closeFloating();
    const menu = document.createElement('div');
    menu.className = 'v21-context-menu';
    const items = [
      ['reply','↩',t('reply')],
      ['react','👍','👍'],
      ['react','😂','😂']
    ];
    if (canEditMessage(message, kind)) items.push(['edit','✎',t('edit')]);
    if (canDeleteMessage(message, kind)) items.push(['delete','🗑',t('delete')]);
    for (const [action, icon, label] of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.action = action;
      if (action === 'delete') b.classList.add('danger');
      b.innerHTML = `<span>${icon}</span><span>${esc(label)}</span>`;
      b.onclick = () => {
        menu.remove(); contextMenu = null;
        if (action === 'reply') setReply({ kind, message });
        if (action === 'edit') startInlineEdit(messageId, kind);
        if (action === 'delete') requestDelete(messageId, kind);
        if (action === 'react') reactMessage(messageId, kind, icon);
      };
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(innerWidth - rect.width - 8, x))}px`;
    menu.style.top = `${Math.max(8, Math.min(innerHeight - rect.height - 8, y))}px`;
    contextMenu = menu;
  }

  els.messages?.addEventListener('click', event => {
    const action = event.target.closest?.('[data-v21-action]');
    const reaction = event.target.closest?.('.v21-reaction');
    const target = action || reaction;
    if (!target) return;
    event.preventDefault(); event.stopPropagation();
    const messageId = target.dataset.messageId;
    const kind = target.dataset.messageKind;
    const act = target.dataset.v21Action || 'react';
    if (act === 'reply') {
      const message = findMessage(messageId, kind); if (message) setReply({ kind, message });
    } else if (act === 'edit') startInlineEdit(messageId, kind);
    else if (act === 'react') reactMessage(messageId, kind, target.dataset.emoji || '👍');
    else if (act === 'more') {
      const r = target.getBoundingClientRect(); showMessageMenu(messageId, kind, r.right - 190, r.bottom + 4);
    }
  });

  els.messages?.addEventListener('contextmenu', event => {
    const row = event.target.closest?.('.message[data-message-id]');
    if (!row) return;
    event.preventDefault();
    showMessageMenu(row.dataset.messageId, row.dataset.messageKind, event.clientX, event.clientY);
  });

  /* Slash commands */
  const COMMANDS = [
    { name:'/clear', icon:'⌫', desc:'commands.clear' },
    { name:'/help', icon:'?', desc:'commands.help' },
    { name:'/call', icon:'☎', desc:'commands.call' },
    { name:'/mute', icon:'🎤', desc:'commands.mute' },
    { name:'/deafen', icon:'🎧', desc:'commands.deafen' },
    { name:'/status', icon:'●', desc:'commands.status' }
  ];

  function ensureCommandMenu() {
    if (commandMenu) return commandMenu;
    commandMenu = document.createElement('div');
    commandMenu.id = 'v21CommandMenu';
    commandMenu.className = 'v21-command-menu hidden';
    els.messageForm?.appendChild(commandMenu);
    return commandMenu;
  }

  function commandMatches() {
    const value = String(els.messageInput?.value || '');
    if (!value.startsWith('/') || value.includes(' ')) return [];
    return COMMANDS.filter(c => c.name.startsWith(value.toLowerCase()));
  }

  function renderCommandMenu() {
    const menu = ensureCommandMenu();
    const rows = commandMatches();
    if (!rows.length) { menu.classList.add('hidden'); return; }
    commandIndex = Math.max(0, Math.min(commandIndex, rows.length - 1));
    menu.innerHTML = `<div class="v21-command-title">${esc(t('commands.title'))}</div>` + rows.map((c,i) => `<div class="v21-command-item ${i===commandIndex?'active':''}" data-command="${c.name}"><div class="v21-command-icon">${c.icon}</div><div class="v21-command-copy"><b>${c.name}</b><small>${esc(t(c.desc))}</small></div></div>`).join('');
    menu.classList.remove('hidden');
    for (const item of menu.querySelectorAll('[data-command]')) item.onclick = () => {
      els.messageInput.value = `${item.dataset.command} `;
      menu.classList.add('hidden'); els.messageInput.focus();
    };
  }

  els.messageInput?.addEventListener('input', () => { commandIndex = 0; renderCommandMenu(); });
  els.messageInput?.addEventListener('keydown', event => {
    const rows = commandMatches();
    if (rows.length && !ensureCommandMenu().classList.contains('hidden')) {
      if (event.key === 'ArrowDown') { event.preventDefault(); commandIndex = (commandIndex + 1) % rows.length; renderCommandMenu(); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); commandIndex = (commandIndex - 1 + rows.length) % rows.length; renderCommandMenu(); return; }
      if (event.key === 'Tab') { event.preventDefault(); els.messageInput.value = `${rows[commandIndex].name} `; ensureCommandMenu().classList.add('hidden'); return; }
      if (event.key === 'Escape') { ensureCommandMenu().classList.add('hidden'); return; }
    }
    if (event.key === 'ArrowUp' && !els.messageInput.value && !event.shiftKey) {
      const ctx = messageContext();
      const mine = [...(ctx?.list || [])].reverse().find(m => canEditMessage(m, ctx.kind));
      if (mine) { event.preventDefault(); startInlineEdit(mine.id, ctx.kind); }
    }
  });

  function commandHelp() {
    openModal(`<div><h2>${esc(t('commands.title'))}</h2><div class="v21-choice-grid">${COMMANDS.map(c => `<div class="v21-choice"><b>${c.name}</b><span>${esc(t(c.desc))}</span></div>`).join('')}</div><p><small>/clear 20 · /clear mine · /clear all<br>/status online · /status away · /status busy</small></p></div>`);
  }

  function runClear(arg = '') {
    const ctx = messageContext(); if (!ctx) return;
    const lower = String(arg || '').toLowerCase();
    let amount = 20;
    if (/^\d+$/.test(lower)) amount = Math.max(1, Math.min(100, Number(lower)));
    if (['mine','all'].includes(lower)) amount = 100;
    const moderator = ctx.kind === 'server' && (ROLE_RANK_V21[currentRole()] || 0) >= ROLE_RANK_V21.moderator;
    const mode = ctx.kind === 'server' && moderator && lower !== 'mine' ? 'all' : 'mine';
    const execute = () => {
      const event = ctx.kind === 'dm' ? 'dm:clear' : 'messages:clear';
      const payload = ctx.kind === 'dm'
        ? { userId:state.activeDmUserId, amount }
        : { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, amount, mode, all: lower === 'all' };
      state.socket.emit(event, payload, result => {
        if (result?.ok === false) return toast(result.message || 'Não foi possível limpar as mensagens.', 4200);
        toast(t('clear.done', { count:result?.count || 0 }), 3200);
      });
    };
    if (lower === 'all') confirmDialog(t('clear.confirmTitle'), t('clear.confirmBody'), t('confirm'), execute, true);
    else execute();
  }

  function setManualStatus(raw) {
    const map = { online:'online', disponible:'online', disponivel:'online', 'en-línea':'online', enlinea:'online', away:'away', ausente:'away', busy:'busy', ocupado:'busy' };
    const next = map[String(raw || '').toLowerCase()];
    if (!next) return toast('/status online | away | busy', 3200);
    state.ui.status = next; effectiveAutoStatus = '';
    savePrefs();
    state.socket.emit('profile:update', { status:next });
  }

  function executeCommand(raw) {
    const [name, ...parts] = String(raw || '').trim().split(/\s+/);
    const arg = parts.join(' ');
    switch (name.toLowerCase()) {
      case '/clear': runClear(arg); break;
      case '/help': commandHelp(); break;
      case '/call': {
        if (state.viewMode !== 'dm' || !state.activeDmUserId) return toast('Abra uma conversa privada para iniciar uma chamada.', 3200);
        document.getElementById('v212DmCallBtn')?.click(); break;
      }
      case '/mute': toggleMute(); break;
      case '/deafen': toggleDeafen(); break;
      case '/status': setManualStatus(arg); break;
      default: toast('Comando desconhecido. Digite /help.', 2800);
    }
  }

  els.messageForm?.addEventListener('submit', event => {
    const raw = String(els.messageInput.value || '').trim();
    if (raw.startsWith('/')) {
      event.preventDefault(); event.stopImmediatePropagation();
      els.messageInput.value = ''; ensureCommandMenu().classList.add('hidden'); executeCommand(raw); return;
    }
    if (replyTarget && raw) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (replyTarget.kind === 'dm' && state.viewMode === 'dm') state.socket.emit('dm:send', { userId:state.activeDmUserId, text:raw, replyToId:replyTarget.message.id });
      else if (replyTarget.kind === 'server' && state.selectedServer && state.selectedChannel?.type === 'text') state.socket.emit('message:send', { serverId:state.selectedServer.id, channelId:state.selectedChannel.id, text:raw, replyToId:replyTarget.message.id });
      els.messageInput.value = ''; setReply(null);
    }
  }, true);

  /* Premium channel tree */
  function collapsedKey(categoryId) { return `banana.v21.category.${state.selectedServer?.id || ''}.${categoryId}`; }
  function isCollapsed(categoryId) { return localStorage.getItem(collapsedKey(categoryId)) === '1'; }
  function setCollapsed(categoryId, value) { localStorage.setItem(collapsedKey(categoryId), value ? '1' : '0'); }

  function positionFloating(node, anchor) {
    document.body.appendChild(node);
    const a = anchor.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(innerWidth-r.width-8, a.right-r.width))}px`;
    node.style.top = `${Math.max(8, Math.min(innerHeight-r.height-8, a.bottom+5))}px`;
  }

  function openCreatePopover(anchor, categoryId = null) {
    closeFloating(); anchor.dataset.v21PopoverAnchor = '1';
    const menu = document.createElement('div'); menu.className = 'v21-popover v21-create-menu';
    const options = [
      ['text','#',t('create.text'),t('create.textSub')],
      ['voice','🔊',t('create.voice'),t('create.voiceSub')],
      ['category','▦',t('create.category'),t('create.categorySub')]
    ];
    for (const [kind,icon,label,sub] of options) {
      const button = document.createElement('button'); button.className = 'v21-create-option'; button.type = 'button';
      button.innerHTML = `<span class="v21-create-icon">${icon}</span><span class="v21-create-copy"><b>${esc(label)}</b><small>${esc(sub)}</small></span>`;
      button.onclick = () => { menu.remove(); popover = null; if (kind === 'category') openCategoryCreate(); else openChannelCreate(kind, categoryId); };
      menu.appendChild(button);
    }
    positionFloating(menu, anchor); popover = menu;
  }

  function categoryChoices(selected = null) {
    const cats = state.selectedServer?.categories || [];
    return [{ id:'', name:t('noCategory') }, ...cats].map(cat => `<button type="button" class="v21-choice ${String(selected||'')===cat.id?'active':''}" data-category-choice="${esc(cat.id)}">${esc(cat.name)}</button>`).join('');
  }

  function wireCategoryChoices(root, initial = null) {
    let selected = initial || '';
    const choose = id => {
      selected = id || '';
      root.querySelectorAll('[data-category-choice]').forEach(b => b.classList.toggle('active', b.dataset.categoryChoice === selected));
    };
    root.querySelectorAll('[data-category-choice]').forEach(button => button.onclick = () => choose(button.dataset.categoryChoice));
    return () => selected;
  }

  function openChannelCreate(type, categoryId = null) {
    openModal(`<h2>${esc(type === 'voice' ? t('create.voice') : t('create.text'))}</h2><label>Nome</label><input id="v21ChannelName" maxlength="32" placeholder="${type==='voice'?'Gaming':'geral'}"><label>${esc(t('create.category'))}</label><div id="v21CategoryChoices" class="v21-choice-grid">${categoryChoices(categoryId)}</div><button id="v21CreateChannelNow">${esc(type === 'voice' ? t('create.voice') : t('create.text'))}</button>`);
    const getCategory = wireCategoryChoices($('v21CategoryChoices'), categoryId);
    $('v21CreateChannelNow').onclick = () => {
      const name = $('v21ChannelName').value.trim(); if (!name) return;
      state.socket.emit('channel:create', { serverId:state.selectedServer.id, type, name, categoryId:getCategory() || null }); closeModal();
    };
    setTimeout(() => $('v21ChannelName')?.focus(), 0);
  }

  function openCategoryCreate() {
    openModal(`<h2>${esc(t('create.category'))}</h2><label>Nome</label><input id="v21CategoryName" maxlength="32" placeholder="Jogos"><button id="v21CreateCategoryNow">${esc(t('create.category'))}</button>`);
    $('v21CreateCategoryNow').onclick = () => { const name=$('v21CategoryName').value.trim(); if(name){ state.socket.emit('category:create',{serverId:state.selectedServer.id,name}); closeModal(); } };
    setTimeout(() => $('v21CategoryName')?.focus(), 0);
  }

  function openChannelEdit(channel) {
    openModal(`<h2>${esc(channel.type==='voice'?t('create.voice'):t('create.text'))}</h2><label>Nome</label><input id="v21EditChannelName" maxlength="32" value="${esc(channel.name)}"><label>${esc(t('create.category'))}</label><div id="v21MoveChoices" class="v21-choice-grid">${categoryChoices(channel.categoryId)}</div><button id="v21SaveChannel">${esc(t('save'))}</button><button id="v21DeleteChannel" class="danger-action">${esc(t('delete'))}</button>`);
    const getCategory = wireCategoryChoices($('v21MoveChoices'), channel.categoryId);
    $('v21SaveChannel').onclick = () => {
      const name = $('v21EditChannelName').value.trim(); if (!name) return;
      state.socket.emit('channel:update',{serverId:state.selectedServer.id,channelId:channel.id,name,categoryId:getCategory()||null}); closeModal();
    };
    $('v21DeleteChannel').onclick = () => confirmDialog(`${t('delete')} ${channel.name}?`, 'O canal e seu conteúdo serão removidos.', t('delete'), () => state.socket.emit('channel:update',{serverId:state.selectedServer.id,channelId:channel.id,action:'delete'}), true);
  }

  function openCategoryMenu(anchor, category) {
    closeFloating(); anchor.dataset.v21PopoverAnchor = '1';
    const menu = document.createElement('div'); menu.className='v21-popover';
    const add = (label, fn, danger=false) => { const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.classList.add('danger');b.onclick=()=>{menu.remove();popover=null;fn()};menu.appendChild(b); };
    add(`# ${t('create.text')}`,()=>openChannelCreate('text',category.id));
    add(`🔊 ${t('create.voice')}`,()=>openChannelCreate('voice',category.id));
    const sep=document.createElement('div');sep.className='v21-popover-sep';menu.appendChild(sep);
    add(t('rename'),()=>{openModal(`<h2>${esc(t('rename'))}</h2><input id="v21RenameCategory" maxlength="32" value="${esc(category.name)}"><button id="v21RenameCategoryNow">${esc(t('save'))}</button>`);$('v21RenameCategoryNow').onclick=()=>{const name=$('v21RenameCategory').value.trim();if(name)state.socket.emit('category:update',{serverId:state.selectedServer.id,categoryId:category.id,name});closeModal();};});
    add(t('delete'),()=>confirmDialog(`${t('delete')} ${category.name}?`,'Os canais serão mantidos e movidos para fora da categoria.',t('delete'),()=>state.socket.emit('category:update',{serverId:state.selectedServer.id,categoryId:category.id,action:'delete'}),true),true);
    positionFloating(menu,anchor);popover=menu;
  }

  function buildChannelRow(channel, manage) {
    const row=document.createElement('div');row.className='v21-channel-row';row.dataset.channelId=channel.id;row.draggable=manage;
    const button=document.createElement('button');button.className='channel'+(state.selectedChannel?.id===channel.id?' active':'');button.innerHTML=`<span class="symbol">${channel.type==='voice'?'🔊':'#'}</span><span>${esc(channel.name)}</span>`;button.onclick=()=>selectChannel(channel.id);
    if(channel.type==='voice')button.ondblclick=async e=>{e.preventDefault();e.stopPropagation();selectChannel(channel.id);await joinVoice(channel)};
    row.appendChild(button);
    if(manage){const more=document.createElement('button');more.type='button';more.className='v21-channel-more';more.textContent='⋯';more.title=t('more');more.onclick=e=>{e.stopPropagation();openChannelEdit(channel)};row.appendChild(more);
      row.addEventListener('dragstart',e=>{row.classList.add('dragging');e.dataTransfer.setData('text/plain',channel.id);e.dataTransfer.effectAllowed='move'});row.addEventListener('dragend',()=>row.classList.remove('dragging'));
      row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('drag-over')});row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('drag-over');const from=e.dataTransfer.getData('text/plain');if(!from||from===channel.id)return;const moved=state.selectedServer.channels.find(c=>c.id===from);if(moved&&moved.categoryId!==channel.categoryId)state.socket.emit('channel:update',{serverId:state.selectedServer.id,channelId:from,categoryId:channel.categoryId||null});state.socket.emit('channel:reorder',{serverId:state.selectedServer.id,channelId:from,beforeId:channel.id});});
    }
    return row;
  }

  function renderChannelsV21() {
    const server=state.selectedServer;els.channels.innerHTML='';if(!server)return;const manage=can('moderator');
    const head=document.createElement('div');head.className='v21-channel-head';head.innerHTML=`<span>${esc(t('channels'))}</span>`;if(manage){const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.title=t('channels');plus.onclick=()=>openCreatePopover(plus,null);head.appendChild(plus)}els.channels.appendChild(head);
    const ungrouped=document.createElement('div');ungrouped.className='v21-uncategorized-drop';if(manage){ungrouped.addEventListener('dragover',e=>{e.preventDefault();ungrouped.classList.add('drag-over')});ungrouped.addEventListener('dragleave',()=>ungrouped.classList.remove('drag-over'));ungrouped.addEventListener('drop',e=>{e.preventDefault();ungrouped.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id)state.socket.emit('channel:update',{serverId:server.id,channelId:id,categoryId:null})});}els.channels.appendChild(ungrouped);
    for(const channel of server.channels.filter(c=>!c.categoryId)){const row=buildChannelRow(channel,manage);els.channels.appendChild(row);if(channel.type==='voice')renderVoiceUsers(els.channels,channel.id);}
    for(const category of server.categories||[]){const section=document.createElement('section');section.className='v21-category'+(isCollapsed(category.id)?' collapsed':'');section.dataset.categoryId=category.id;const title=document.createElement('div');title.className='v21-category-title';const toggle=document.createElement('button');toggle.type='button';toggle.className='v21-category-toggle';toggle.textContent='▼';const name=document.createElement('span');name.className='v21-category-name';name.textContent=category.name;title.append(toggle,name);if(manage){const actions=document.createElement('div');actions.className='v21-category-actions';const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.onclick=e=>{e.stopPropagation();openCreatePopover(plus,category.id)};const more=document.createElement('button');more.type='button';more.textContent='⋯';more.onclick=e=>{e.stopPropagation();openCategoryMenu(more,category)};actions.append(plus,more);title.appendChild(actions);title.addEventListener('dragover',e=>{e.preventDefault();title.classList.add('drag-over')});title.addEventListener('dragleave',()=>title.classList.remove('drag-over'));title.addEventListener('drop',e=>{e.preventDefault();title.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id)state.socket.emit('channel:update',{serverId:server.id,channelId:id,categoryId:category.id})});}const body=document.createElement('div');body.className='v21-category-body';toggle.onclick=name.onclick=()=>{const next=!section.classList.contains('collapsed');section.classList.toggle('collapsed',next);setCollapsed(category.id,next)};for(const channel of server.channels.filter(c=>c.categoryId===category.id)){const row=buildChannelRow(channel,manage);body.appendChild(row);if(channel.type==='voice')renderVoiceUsers(body,channel.id);}section.append(title,body);els.channels.appendChild(section);}
  }

  renderChannels = renderChannelsV21;

  /* Custom role picker */
  function enhanceRolePickers() {
    for(const select of document.querySelectorAll('select.v219-role-select')){
      const userId=select.dataset.user;const current=select.value;const picker=document.createElement('div');picker.className='v21-role-picker';
      const label=role=>t(`role.${role}`);const sub=role=>t(`role.${role}Sub`);
      picker.innerHTML=`<button type="button" class="v21-role-button"><span class="v21-role-current"><span class="v21-role-dot" style="color:${ROLE_COLORS[current]};background:${ROLE_COLORS[current]}"></span><span>${esc(label(current))}</span></span><span>⌄</span></button><div class="v21-role-menu hidden">${['member','moderator','admin'].map(role=>`<button type="button" class="v21-role-option" data-role="${role}"><span class="v21-role-dot" style="color:${ROLE_COLORS[role]};background:${ROLE_COLORS[role]}"></span><span><b>${esc(label(role))}</b><small>${esc(sub(role))}</small></span><span class="v21-role-check">${role===current?'✓':''}</span></button>`).join('')}</div>`;
      select.replaceWith(picker);const button=picker.querySelector('.v21-role-button'),menu=picker.querySelector('.v21-role-menu');button.onclick=e=>{e.stopPropagation();document.querySelectorAll('.v21-role-menu').forEach(x=>x!==menu&&x.classList.add('hidden'));menu.classList.toggle('hidden')};for(const option of menu.querySelectorAll('[data-role]'))option.onclick=()=>{const role=option.dataset.role;state.socket.emit('member:set-role',{serverId:state.selectedServer.id,userId,role});button.querySelector('.v21-role-current').innerHTML=`<span class="v21-role-dot" style="color:${ROLE_COLORS[role]};background:${ROLE_COLORS[role]}"></span><span>${esc(label(role))}</span>`;menu.classList.add('hidden');toast(`${label(role)} ✓`);};
    }
  }

  const openServerSettingsBase = openServerSettings;
  openServerSettings = function openServerSettingsV21(...args){const result=openServerSettingsBase(...args);setTimeout(enhanceRolePickers,0);return result;};

  /* System/social settings and presence */
  function formatElapsed(ms) {
    const total=Math.max(0,Math.floor(ms/60000));if(total<1)return '< 1 min';if(total<60)return `${total} min`;const h=Math.floor(total/60),m=total%60;return m?`${h}h ${m}min`:`${h}h`;
  }
  function activityText(activity){if(!activity)return'';return `${t('activity.playing',{game:activity.name})} · ${t('activity.for',{time:formatElapsed(Date.now()-Number(activity.startedAt||Date.now()))})}`;}

  function decorateActivities() {
    const roleOrder=['owner','admin','moderator','member'];
    const all=[...state.members.values()];const online=all.filter(u=>u.status!=='offline');const offline=all.filter(u=>u.status==='offline');const ordered=[];for(const role of roleOrder)ordered.push(...online.filter(u=>(u.role||roleFor(u.id))===role).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')));ordered.push(...offline.sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')));
    const rows=[...document.querySelectorAll('.v219-member-row')];rows.forEach((row,i)=>{row.querySelector('.v21-activity-line')?.remove();const user=ordered[i];if(!user?.activity)return;const copy=row.querySelector('.v219-member-copy');if(!copy)return;const line=document.createElement('div');line.className='v21-activity-line';line.innerHTML=`🎮 <span>${esc(t('activity.playing',{game:user.activity.name}))}</span>`;copy.appendChild(line);});
  }

  const renderMembersBaseV21 = renderMembers;
  renderMembers = function renderMembersSocialV21(...args){const result=renderMembersBaseV21(...args);decorateActivities();return result;};

  const openMemberProfileBaseV21 = openMemberProfile;
  openMemberProfile = function openMemberProfileSocialV21(userId,...args){const result=openMemberProfileBaseV21(userId,...args);setTimeout(()=>{const user=state.members.get(userId);if(!user?.activity)return;const main=document.querySelector('.v219-profile-main');if(!main||main.querySelector('.v21-profile-activity'))return;const block=document.createElement('div');block.className='v21-profile-activity';block.innerHTML=`<small>ATIVIDADE</small><b>🎮 ${esc(t('activity.playing',{game:user.activity.name}))}</b><span>${esc(t('activity.for',{time:formatElapsed(Date.now()-Number(user.activity.startedAt||Date.now()))}))}</span>`;const info=main.querySelector('.v219-profile-info');if(info)main.insertBefore(block,info);else main.appendChild(block);},0);return result;};

  function syncSystemPresence() {
    if(!state.user?.id||!state.socket)return;
    const manual=state.ui.status||'online';const mins=Math.max(1,Number(systemState.settings?.autoAwayMinutes||5));const shouldAway=manual==='online'&&(systemState.idleState==='locked'||Number(systemState.idleSeconds||0)>=mins*60);const desired=manual==='online'?(shouldAway?'away':'online'):manual;
    if(desired!==effectiveAutoStatus){effectiveAutoStatus=desired;state.user.status=desired;renderSelf();state.socket.emit('presence:set',{state:desired});}
    const activity=systemState.settings?.shareActivity!==false?systemState.activity:null;const key=activity?`${activity.id}:${activity.startedAt}`:'none';if(key!==publishedActivityKey){publishedActivityKey=key;state.socket.emit('presence:activity',{activity:activity||null});}
    decorateActivities();
  }

  ipcRenderer.on('banana-v21:system-state',(_event,payload)=>{systemState={...systemState,...payload,settings:{...systemState.settings,...payload?.settings}};syncSystemPresence();refreshSocialSettingsPreview();});
  ipcRenderer.invoke('banana-v21:get-settings').then(payload=>{systemState={...systemState,...payload,settings:{...systemState.settings,...payload?.settings}};syncSystemPresence();}).catch(()=>{});

  function refreshSocialSettingsPreview(){const box=document.getElementById('v21ActivityPreview');if(!box)return;const activity=systemState.activity;box.querySelector('b').textContent=activity?t('activity.playing',{game:activity.name}):t('activity.none');box.querySelector('small').textContent=activity?t('activity.for',{time:formatElapsed(Date.now()-Number(activity.startedAt||Date.now()))}):'';}

  function showSocialSettings() {
    const area=$('settingsArea');if(!area)return;document.querySelectorAll('.settings-nav-item').forEach(b=>b.classList.remove('active'));$('tabV21Social')?.classList.add('active');if($('settingsTitle'))$('settingsTitle').textContent=t('settings.social');if($('settingsSubtitle'))$('settingsSubtitle').textContent=t('settings.socialSub');const locale=i18n()?.getLocale?.()||'pt-BR',startup=!!systemState.settings?.startup?.enabled,share=systemState.settings?.shareActivity!==false,mins=Number(systemState.settings?.autoAwayMinutes||5);
    area.innerHTML=`<div class="v21-settings-grid"><section class="v21-setting-card"><h3>🌎 ${esc(t('language.title'))}</h3><p>${esc(t('language.help'))}</p><div class="v21-language-grid"><button class="v21-language ${locale==='pt-BR'?'active':''}" data-language="pt-BR">🇧🇷 Português</button><button class="v21-language ${locale==='en-US'?'active':''}" data-language="en-US">🇺🇸 English</button><button class="v21-language ${locale==='es-ES'?'active':''}" data-language="es-ES">🇪🇸 Español</button></div></section><section class="v21-setting-card"><div class="v21-setting-line"><div><h3>🚀 ${esc(t('startup.title'))}</h3><p>${esc(t('startup.help'))}</p></div><label class="v21-switch"><input id="v21Startup" type="checkbox" ${startup?'checked':''}><span></span></label></div></section><section class="v21-setting-card"><div class="v21-setting-line"><div><h3>🌙 ${esc(t('away.title'))}</h3><p>${esc(t('away.help'))}</p></div></div><div class="v21-idle-options">${[5,10,15,30].map(n=>`<button type="button" class="${mins===n?'active':''}" data-idle-minutes="${n}">${n} min</button>`).join('')}</div></section><section class="v21-setting-card"><div class="v21-setting-line"><div><h3>🎮 ${esc(t('activity.title'))}</h3><p>${esc(t('activity.help'))}</p></div><label class="v21-switch"><input id="v21ShareActivity" type="checkbox" ${share?'checked':''}><span></span></label></div><div id="v21ActivityPreview" class="v21-activity-preview"><div class="v21-activity-game">🎮</div><div><b></b><small></small></div></div></section><div class="v21-settings-save"><button id="v21SaveSocial" class="action">${esc(t('save'))}</button></div></div>`;
    let selectedMinutes=mins;for(const button of area.querySelectorAll('[data-language]'))button.onclick=()=>{i18n()?.setLocale?.(button.dataset.language);showSocialSettings();};for(const button of area.querySelectorAll('[data-idle-minutes]'))button.onclick=()=>{selectedMinutes=Number(button.dataset.idleMinutes);area.querySelectorAll('[data-idle-minutes]').forEach(b=>b.classList.toggle('active',b===button));};$('v21SaveSocial').onclick=async()=>{try{const next=await ipcRenderer.invoke('banana-v21:set-settings',{startupEnabled:$('v21Startup').checked,shareActivity:$('v21ShareActivity').checked,autoAwayMinutes:selectedMinutes});systemState={...systemState,...next,settings:{...systemState.settings,...next?.settings}};toast(t('saved'));syncSystemPresence();showSocialSettings();}catch(error){toast(error?.message||'Não consegui salvar.',4200)}};refreshSocialSettingsPreview();
  }

  const openSettingsBaseV21 = openSettings;
  function injectSocialSettings(){const nav=document.querySelector('.settings-nav-list');if(!nav||$('tabV21Social'))return;const button=document.createElement('button');button.id='tabV21Social';button.className='settings-nav-item';button.innerHTML=`<span>🌎</span><b>${esc(t('settings.social'))}</b>`;button.onclick=showSocialSettings;nav.appendChild(button);$('tabProfile')?.addEventListener('click',()=>setTimeout(()=>{if($('profileStatus'))$('profileStatus').value=state.ui.status||'online';},0));}
  function openSettingsV21(...args){const result=openSettingsBaseV21(...args);setTimeout(injectSocialSettings,0);return result;}
  openSettings=openSettingsV21;
  els.profileBtn?.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openSettingsV21();},true);

  window.addEventListener('banana:i18n-changed',()=>{if($('tabV21Social'))$('tabV21Social').querySelector('b').textContent=t('settings.social');renderChannels();renderMessages();renderDmMessages();decorateActivities();});
  setInterval(()=>{decorateActivities();refreshSocialSettingsPreview();},30000);

  ensureReplyBar();
})();
