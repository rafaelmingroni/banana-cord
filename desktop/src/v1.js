/* Banana Cord v1.0.0 — camada pós-beta, sem frameworks pesados. */
(() => {
  const V1_VERSION = '1.0.0';
  const REACTIONS = ['👍', '❤️', '😂', '👎'];
  const v1 = state.v1 = {
    unreadChannels: new Set(),
    mentionCounts: new Map(),
    social: { friends: [], incoming: [], outgoing: [], blocked: [] },
    reply: null,
    editing: null,
    menu: null,
    serverOrder: readJson('serverOrder', []),
    pinnedDms: new Set(readJson('pinnedDms', [])),
    collapsedCategories: new Set(readJson('collapsedCategories', [])),
    lastVolumes: readJson('lastPeerVolumes', {}),
    socialLoaded: false,
  };

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`banana.${key}`) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(`banana.${key}`, JSON.stringify(value)); }
  function channelKey(serverId, channelId) { return `${serverId || ''}:${channelId || ''}`; }
  function socialIds(kind) { return new Set((v1.social[kind] || []).map(u => u.id)); }
  function isBlocked(id) { return socialIds('blocked').has(id); }
  function isFriend(id) { return socialIds('friends').has(id); }
  function isIncoming(id) { return socialIds('incoming').has(id); }
  function isOutgoing(id) { return socialIds('outgoing').has(id); }
  function currentPeer(id) { return state.members.get(id) || ['friends','incoming','outgoing','blocked'].flatMap(k=>v1.social[k]||[]).find(u=>u.id===id) || state.dmConversations.find(c => c.user?.id === id)?.user || null; }

  function closeContextMenu() {
    v1.menu?.remove();
    v1.menu = null;
  }
  function openContextMenu(x, y, items) {
    closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'v1-context-menu';
    for (const item of items.filter(Boolean)) {
      if (item.separator) {
        const sep = document.createElement('div'); sep.className = 'v1-menu-sep'; menu.appendChild(sep); continue;
      }
      if (item.reactions) {
        const row = document.createElement('div'); row.className = 'v1-menu-reactions';
        for (const emoji of item.reactions) {
          const b = document.createElement('button'); b.textContent = emoji; b.title = `Reagir com ${emoji}`;
          b.onclick = () => { closeContextMenu(); item.onPick?.(emoji); };
          row.appendChild(b);
        }
        menu.appendChild(row); continue;
      }
      const b = document.createElement('button');
      b.className = `v1-menu-item${item.danger ? ' danger' : ''}`;
      b.disabled = !!item.disabled;
      b.innerHTML = `<span>${item.icon || ''}</span><b>${escapeHtml(item.label || '')}</b>${item.hint ? `<small>${escapeHtml(item.hint)}</small>` : ''}`;
      b.onclick = () => { closeContextMenu(); item.action?.(); };
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    v1.menu = menu;
  }
  window.addEventListener('mousedown', e => { if (v1.menu && !v1.menu.contains(e.target)) closeContextMenu(); }, true);
  window.addEventListener('blur', closeContextMenu);
  window.addEventListener('resize', closeContextMenu);

  // ---------- Socket v1 ----------
  const bindSocketBase = bindSocket;
  bindSocket = function bindSocketV1(socket) {
    bindSocketBase(socket);
    socket.on('auth:ready', () => socket.emit('social:get'));
    socket.on('social:state', data => {
      const previousIncoming = new Set((v1.social.incoming || []).map(u => u.id));
      v1.social = {
        friends: Array.isArray(data?.friends) ? data.friends : [],
        incoming: Array.isArray(data?.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data?.outgoing) ? data.outgoing : [],
        blocked: Array.isArray(data?.blocked) ? data.blocked : [],
      };
      const fresh = v1.social.incoming.find(u => !previousIncoming.has(u.id));
      if (fresh && v1.socialLoaded) toast(`${fresh.name} enviou uma solicitação de amizade.`, 3600);
      v1.socialLoaded = true;
      if (state.viewMode === 'dm') renderDmSidebar();
      renderMembers();
    });
    socket.on('message:updated', m => {
      const arr = state.messagesByChannel.get(m.channelId) || [];
      const i = arr.findIndex(x => x.id === m.id); if (i >= 0) arr[i] = m;
      state.messagesByChannel.set(m.channelId, arr);
      if (state.selectedChannel?.id === m.channelId) renderMessages();
    });
    socket.on('message:deleted', ({ channelId, messageId }) => {
      const arr = (state.messagesByChannel.get(channelId) || []).filter(m => m.id !== messageId);
      state.messagesByChannel.set(channelId, arr);
      if (v1.reply?.messageId === messageId || v1.editing?.messageId === messageId) clearComposerMode();
      if (state.selectedChannel?.id === channelId) renderMessages();
    });
    socket.on('message:new', m => {
      const key = channelKey(m.serverId || state.selectedServer?.id, m.channelId);
      const visible = state.viewMode === 'server' && state.selectedChannel?.id === m.channelId && !document.hidden;
      if (!visible && m.authorId !== state.user?.id) v1.unreadChannels.add(key);
      if (Array.isArray(m.mentionIds) && m.mentionIds.includes(state.user?.id) && !visible) v1.mentionCounts.set(key, (v1.mentionCounts.get(key) || 0) + 1);
      renderChannels();
    });
    socket.on('mention:new', ({ serverId, channelId, from }) => {
      const key = channelKey(serverId, channelId);
      const visible = state.viewMode === 'server' && state.selectedServer?.id === serverId && state.selectedChannel?.id === channelId && !document.hidden;
      if (!visible) {
        v1.unreadChannels.add(key);
        v1.mentionCounts.set(key, (v1.mentionCounts.get(key) || 0) + 1);
        if (from?.name) toast(`${from.name} mencionou você.`, 2800);
        renderChannels();
      }
    });
    socket.on('dm:updated', ({ userId, message }) => {
      const arr = state.dmMessages.get(userId) || [];
      const i = arr.findIndex(x => x.id === message?.id); if (i >= 0) arr[i] = message;
      state.dmMessages.set(userId, arr);
      mergeDmConversation(currentPeer(userId) || { id: userId, name: 'Amigo' }, message);
      if (state.viewMode === 'dm') { renderDmSidebar(); if (state.activeDmUserId === userId) renderDmMessages(); }
    });
    socket.on('dm:deleted', ({ userId, messageId }) => {
      const arr = (state.dmMessages.get(userId) || []).filter(m => m.id !== messageId);
      state.dmMessages.set(userId, arr);
      if (v1.reply?.messageId === messageId || v1.editing?.messageId === messageId) clearComposerMode();
      if (state.viewMode === 'dm' && state.activeDmUserId === userId) renderDmMessages();
    });
    socket.on('server:removed', ({ serverId }) => {
      v1.serverOrder = v1.serverOrder.filter(id => id !== serverId); writeJson('serverOrder', v1.serverOrder);
    });
  };

  // ---------- Perfil/status ----------
  const renderSelfBase = renderSelf;
  renderSelf = function renderSelfV1() {
    renderSelfBase();
    if (state.user?.customStatus) els.myStatusText.textContent = state.user.customStatus;
  };

  const modalObserver = new MutationObserver(() => {
    const profileName = $('profileName');
    if (profileName && !$('customStatus')) {
      const grid = profileName.closest('.settings-form-grid');
      if (grid) {
        const field = document.createElement('div'); field.className = 'settings-field v1-custom-status';
        field.innerHTML = `<label>Status personalizado</label><input id="customStatus" maxlength="80" placeholder="Jogando, trabalhando…" value="${escapeHtml(state.user?.customStatus || '')}"><small>Aparece abaixo do seu nome.</small>`;
        grid.insertAdjacentElement('afterend', field);
        $('saveProfile')?.addEventListener('click', () => state.socket?.emit('profile:update', { customStatus: $('customStatus')?.value || '' }), true);
      }
    }
    const version = document.querySelector('.version-label'); if (version) version.textContent = `Banana Cord v${V1_VERSION} · pós-beta`;
    const settingsFoot = document.querySelector('.settings-nav-foot'); if (settingsFoot) settingsFoot.textContent = `v${V1_VERSION} · pós-beta`;
  });
  modalObserver.observe(els.modalBody, { childList: true, subtree: true });

  // ---------- Servidores ----------
  function orderedServers() {
    const existing = new Map(state.servers.map(s => [s.id, s]));
    const out = [];
    for (const id of v1.serverOrder) if (existing.has(id)) { out.push(existing.get(id)); existing.delete(id); }
    out.push(...existing.values());
    v1.serverOrder = out.map(s => s.id); writeJson('serverOrder', v1.serverOrder);
    return out;
  }

  renderServers = function renderServersV1() {
    els.homeServer?.classList.toggle('active', state.viewMode === 'dm');
    els.serverList.innerHTML = '';
    for (const s of orderedServers()) {
      const b = document.createElement('button');
      b.className = `server-icon${state.viewMode === 'server' && state.selectedServer?.id === s.id ? ' active' : ''}`;
      b.title = s.name; b.dataset.serverId = s.id; b.draggable = true;
      if (s.icon) { b.style.backgroundImage = `url(${s.icon})`; b.classList.add('has-server-image'); }
      else { const initials=document.createElement('span'); initials.textContent=s.name.trim().slice(0,2).toUpperCase(); b.appendChild(initials); }
      const hasUnread=[...v1.unreadChannels].some(k=>k.startsWith(`${s.id}:`)); const mentionTotal=[...v1.mentionCounts.entries()].filter(([k])=>k.startsWith(`${s.id}:`)).reduce((n,[,v])=>n+v,0);
      if(hasUnread||mentionTotal){const badge=document.createElement('span');badge.className=mentionTotal?'v1-server-mention':'v1-server-unread';badge.textContent=mentionTotal?String(Math.min(9,mentionTotal))+(mentionTotal>9?'+':''):'';b.appendChild(badge);}
      b.onclick = () => selectServer(s.id);
      b.oncontextmenu = e => { e.preventDefault(); openServerMenu(e.clientX, e.clientY, s); };
      b.ondragstart = e => { e.dataTransfer.setData('application/x-banana-server', s.id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); };
      b.ondragend = () => b.classList.remove('dragging');
      b.ondragover = e => e.preventDefault();
      b.ondrop = e => {
        e.preventDefault(); const from = e.dataTransfer.getData('application/x-banana-server'); if (!from || from === s.id) return;
        const order = orderedServers().map(x => x.id).filter(id => id !== from); const at = order.indexOf(s.id); order.splice(Math.max(0, at), 0, from);
        v1.serverOrder = order; writeJson('serverOrder', order); renderServers();
      };
      els.serverList.appendChild(b);
    }
  };

  async function copyInviteFor(s) {
    const url = state.isHost ? (state.publicHostUrl || state.serverUrl) : state.serverUrl;
    await ipcRenderer.invoke('clipboard:write', makeInvite(url, s.inviteCode)); toast('Convite copiado.');
  }
  function renameServer(s) {
    openModal(`<h2>Renomear servidor</h2><label>Novo nome</label><input id="v1ServerName" maxlength="40" value="${escapeHtml(s.name)}"><button id="v1RenameServer" class="action">Salvar</button>`);
    $('v1RenameServer').onclick = () => { const name = $('v1ServerName').value.trim(); if (name) state.socket.emit('server:update', { serverId: s.id, name }); closeModal(); };
  }
  function chooseServerPhoto(s) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 550000) return toast('Use uma foto de servidor menor que 550 KB.', 4000);
      const r = new FileReader(); r.onload = () => state.socket.emit('server:update', { serverId: s.id, icon: r.result }); r.readAsDataURL(file);
    };
    input.click();
  }
  function openServerMenu(x, y, s) {
    const role = roleFor(state.user?.id, s); const own = role === 'owner'; const admin = ROLE_RANK[role] >= ROLE_RANK.admin;
    openContextMenu(x, y, [
      { icon: '🔗', label: 'Copiar convite', action: () => copyInviteFor(s) },
      admin && { icon: '🖼️', label: s.icon ? 'Trocar foto do servidor' : 'Colocar foto no servidor', action: () => chooseServerPhoto(s) },
      admin && s.icon && { icon: '🧹', label: 'Remover foto do servidor', action: () => state.socket.emit('server:update', { serverId: s.id, icon: '' }) },
      admin && { icon: '✏️', label: 'Renomear servidor', action: () => renameServer(s) },
      admin && { icon: '⚙️', label: 'Configurações', action: () => { selectServer(s.id); openServerSettings(); } },
      { separator: true },
      own ? { icon: '🗑️', label: 'Excluir servidor', danger: true, action: () => {
        const typed = prompt(`Para excluir definitivamente “${s.name}”, digite o nome do servidor:`);
        if (typed === s.name) state.socket.emit('server:delete', { serverId: s.id }); else if (typed != null) toast('Nome diferente. O servidor não foi excluído.');
      } } : { icon: '↪', label: 'Sair do servidor', danger: true, action: () => { if (confirm(`Sair de ${s.name}?`)) state.socket.emit('server:leave', { serverId: s.id }); } },
    ]);
  }

  // ---------- Canais/categorias ----------
  const selectChannelBase = selectChannel;
  selectChannel = function selectChannelV1(id) {
    const key = channelKey(state.selectedServer?.id, id); v1.unreadChannels.delete(key); v1.mentionCounts.delete(key);
    selectChannelBase(id); renderChannels();
  };

  function channelBadges(c) {
    const key = channelKey(state.selectedServer?.id, c.id), mentions = v1.mentionCounts.get(key) || 0;
    return `${Array.isArray(c.allowedRoles) && c.allowedRoles.length ? '<span class="v1-lock" title="Canal privado">🔒</span>' : ''}${mentions ? `<span class="v1-mention-badge">${mentions > 9 ? '9+' : mentions}</span>` : v1.unreadChannels.has(key) ? '<span class="v1-unread-dot"></span>' : ''}`;
  }
  function makeChannelRow(c, manage) {
    const row = document.createElement('div'); row.className = 'channel-row'; row.dataset.channelId = c.id; row.draggable = manage;
    const b = document.createElement('button'); b.className = `channel${state.selectedChannel?.id === c.id ? ' active' : ''}`;
    b.innerHTML = `<span class="symbol">${c.type === 'text' ? '#' : '🔊'}</span><span class="v1-channel-name">${escapeHtml(c.name)}</span><span class="v1-channel-badges">${channelBadges(c)}</span>`;
    b.onclick = () => selectChannel(c.id);
    row.appendChild(b);
    if (manage) {
      const actions = document.createElement('div'); actions.className = 'channel-actions';
      const more = document.createElement('button'); more.className = 'channel-more'; more.textContent = '⋯'; more.title = 'Editar canal'; more.onclick = e => { e.stopPropagation(); openV1ChannelEditor(c); };
      actions.appendChild(more); row.appendChild(actions); wireChannelDrag(row, c);
    }
    row.oncontextmenu = e => { if (!manage) return; e.preventDefault(); openContextMenu(e.clientX, e.clientY, [{ icon: '✏️', label: 'Editar canal', action: () => openV1ChannelEditor(c) }, { icon: '🗑️', label: 'Excluir canal', danger: true, action: () => { if (confirm(`Excluir ${c.name}?`)) state.socket.emit('channel:update', { serverId: state.selectedServer.id, channelId: c.id, action: 'delete' }); } }]); };
    return row;
  }
  function appendChannel(container, c, manage) {
    const row = makeChannelRow(c, manage); container.appendChild(row); if (c.type === 'voice') renderVoiceUsers(container, c.id);
  }
  function categorySection(category, channels, manage) {
    const wrap = document.createElement('div'); wrap.className = 'channel-section v1-category';
    const collapsed = category && v1.collapsedCategories.has(category.id);
    const title = document.createElement('div'); title.className = 'channel-section-title';
    const name = category?.name || 'GERAL'; title.innerHTML = `<button class="v1-category-toggle">${category ? (collapsed ? '▸' : '▾') : ''}</button><span>${escapeHtml(name)}</span>`;
    if (category) title.querySelector('.v1-category-toggle').onclick = () => { collapsed ? v1.collapsedCategories.delete(category.id) : v1.collapsedCategories.add(category.id); writeJson('collapsedCategories', [...v1.collapsedCategories]); renderChannels(); };
    if (manage && category) {
      const more = document.createElement('button'); more.className = 'channel-add'; more.textContent = '⋯'; more.onclick = e => { e.stopPropagation(); openCategoryMenu(e.clientX, e.clientY, category); }; title.appendChild(more);
    }
    wrap.appendChild(title);
    if (!collapsed) for (const c of channels) appendChannel(wrap, c, manage);
    return wrap;
  }

  renderChannels = function renderChannelsV1() {
    const s = state.selectedServer; els.channels.innerHTML = ''; if (!s) return;
    const manage = can('moderator');
    if (manage) {
      const tools = document.createElement('div'); tools.className = 'v1-channel-tools';
      tools.innerHTML = '<button id="v1AddText">＋ Texto</button><button id="v1AddVoice">＋ Voz</button><button id="v1AddCategory">＋ Categoria</button>';
      els.channels.appendChild(tools);
      $('v1AddText').onclick = () => openV1ChannelCreate('text'); $('v1AddVoice').onclick = () => openV1ChannelCreate('voice'); $('v1AddCategory').onclick = openCategoryCreate;
    }
    const categories = Array.isArray(s.categories) ? s.categories : [];
    if (!categories.length) {
      for (const type of ['text', 'voice']) {
        const channels = s.channels.filter(c => c.type === type); if (!channels.length) continue;
        const wrap = document.createElement('div'); wrap.className = 'channel-section'; const title = document.createElement('div'); title.className = 'channel-section-title'; title.innerHTML = `<span>${type === 'text' ? 'CANAIS DE TEXTO' : 'CANAIS DE VOZ'}</span>`; wrap.appendChild(title);
        for (const c of channels) appendChannel(wrap, c, manage); els.channels.appendChild(wrap);
      }
      return;
    }
    const loose = s.channels.filter(c => !c.categoryId); if (loose.length) els.channels.appendChild(categorySection(null, loose, manage));
    for (const cat of categories) els.channels.appendChild(categorySection(cat, s.channels.filter(c => c.categoryId === cat.id), manage));
  };

  function roleChecks(selected = []) {
    const labels = [['member', 'Membro'], ['moderator', 'Moderador'], ['admin', 'Administrador']];
    return labels.map(([r, label]) => `<label class="switch-line"><input type="checkbox" class="v1-role-access" value="${r}" ${selected.includes(r) ? 'checked' : ''}> ${label}</label>`).join('');
  }
  function categoryOptions(current = null) {
    return `<option value="">Sem categoria</option>${(state.selectedServer?.categories || []).map(c => `<option value="${escapeHtml(c.id)}" ${current === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}`;
  }
  function selectedRoles() { return [...document.querySelectorAll('.v1-role-access:checked')].map(x => x.value); }
  function openV1ChannelCreate(type) {
    openModal(`<h2>Novo canal ${type === 'voice' ? 'de voz' : 'de texto'}</h2><label>Nome</label><input id="v1ChannelName" maxlength="32" placeholder="${type === 'voice' ? 'Jogando' : 'jogos'}"><label>Categoria</label><select id="v1ChannelCategory">${categoryOptions()}</select><div class="v1-permission-box"><b>Canal privado por cargo</b><small>Deixe tudo desmarcado para permitir todos. O dono sempre tem acesso.</small><div class="switch-grid">${roleChecks([])}</div></div><button id="v1CreateChannel" class="action">Criar canal</button>`);
    $('v1CreateChannel').onclick = () => { const name = $('v1ChannelName').value.trim(); if (!name) return; state.socket.emit('channel:create', { serverId: state.selectedServer.id, type, name, categoryId: $('v1ChannelCategory').value || null, allowedRoles: selectedRoles() }); closeModal(); };
  }
  function openV1ChannelEditor(c) {
    openModal(`<h2>Editar canal</h2><label>Nome</label><input id="v1ChannelEditName" maxlength="32" value="${escapeHtml(c.name)}"><label>Categoria</label><select id="v1ChannelEditCategory">${categoryOptions(c.categoryId || null)}</select><div class="v1-permission-box"><b>Quem pode acessar</b><small>Sem seleção = todos. O dono sempre tem acesso.</small><div class="switch-grid">${roleChecks(c.allowedRoles || [])}</div></div><button id="v1SaveChannel" class="action">Salvar</button><hr class="settings-sep"><button id="v1DeleteChannel" class="danger-action">Excluir canal</button>`);
    $('v1SaveChannel').onclick = () => { state.socket.emit('channel:update', { serverId: state.selectedServer.id, channelId: c.id, name: $('v1ChannelEditName').value, categoryId: $('v1ChannelEditCategory').value || null, allowedRoles: selectedRoles() }); closeModal(); };
    $('v1DeleteChannel').onclick = () => { if (confirm(`Excluir ${c.name}?`)) state.socket.emit('channel:update', { serverId: state.selectedServer.id, channelId: c.id, action: 'delete' }); closeModal(); };
  }
  function openCategoryCreate() {
    openModal('<h2>Nova categoria</h2><label>Nome</label><input id="v1CategoryName" maxlength="32" placeholder="JOGOS"><button id="v1CreateCategory" class="action">Criar categoria</button>');
    $('v1CreateCategory').onclick = () => { const name = $('v1CategoryName').value.trim(); if (name) state.socket.emit('category:create', { serverId: state.selectedServer.id, name }); closeModal(); };
  }
  function openCategoryMenu(x, y, category) {
    openContextMenu(x, y, [
      { icon: '✏️', label: 'Renomear categoria', action: () => { const name = prompt('Novo nome da categoria:', category.name); if (name?.trim()) state.socket.emit('category:update', { serverId: state.selectedServer.id, categoryId: category.id, name }); } },
      { icon: '🗑️', label: 'Excluir categoria', danger: true, action: () => { if (confirm(`Excluir a categoria ${category.name}? Os canais ficarão sem categoria.`)) state.socket.emit('category:update', { serverId: state.selectedServer.id, categoryId: category.id, action: 'delete' }); } },
    ]);
  }

  // ---------- Mensagens ----------
  function formatMessageText(text) {
    let html = escapeHtml(text || '');
    const me = state.user?.name ? `@${escapeHtml(state.user.name)}` : '';
    if (me) html = html.replace(new RegExp(me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<span class="v1-mention">${m}</span>`);
    return html.replace(/\n/g, '<br>');
  }
  function messageArray(isDm) { return isDm ? (state.dmMessages.get(state.activeDmUserId) || []) : (state.messagesByChannel.get(state.selectedChannel?.id) || []); }
  function authorForMessage(m, isDm) {
    if (isDm) return m.fromId === state.user?.id ? state.user : (currentPeer(state.activeDmUserId) || { id: state.activeDmUserId, name: 'Amigo' });
    return state.members.get(m.authorId) || { id: m.authorId, name: 'Usuário', status: 'offline' };
  }
  function reactionHtml(m) {
    const rows = Object.entries(m.reactions || {}).filter(([, ids]) => Array.isArray(ids) && ids.length);
    return rows.length ? `<div class="v1-reactions">${rows.map(([emoji, ids]) => `<button data-reaction="${emoji}" class="${ids.includes(state.user?.id) ? 'mine' : ''}">${emoji} <span>${ids.length}</span></button>`).join('')}</div>` : '';
  }
  function buildMessageRow(m, isDm = false) {
    const u = authorForMessage(m, isDm), mine = isDm ? m.fromId === state.user?.id : m.authorId === state.user?.id;
    const role = isDm ? 'member' : (u.role || roleFor(isDm ? '' : m.authorId));
    const row = document.createElement('div'); row.className = `message v1-message${Array.isArray(m.mentionIds) && m.mentionIds.includes(state.user?.id) ? ' mention-me' : ''}`; row.dataset.messageId = m.id;
    const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, u); av.oncontextmenu = e => { if (isDm) return; e.preventDefault(); openMemberMenu(e.clientX, e.clientY, u.id); };
    const body = document.createElement('div'); body.className = 'v1-message-body';
    const arr = messageArray(isDm), reply = m.replyToId ? arr.find(x => x.id === m.replyToId) : null;
    body.innerHTML = `${reply ? `<div class="v1-reply-preview"><span>↪</span><b>${escapeHtml(authorForMessage(reply, isDm)?.name || 'Usuário')}</b><small>${escapeHtml(String(reply.text || '').slice(0, 100))}</small></div>` : ''}<div class="msg-head"><b class="${isDm ? '' : `role-color-${role}`}">${escapeHtml(isDm && mine ? 'Você' : u.name)}</b><small>${fmtTime(m.at)}${m.editedAt ? ' · editado' : ''}</small></div><div class="msg-text">${formatMessageText(m.text)}</div>${reactionHtml(m)}<div class="v1-message-actions"><button data-action="reply" title="Responder">↩</button><button data-action="react" title="Reagir">☺</button>${mine ? '<button data-action="edit" title="Editar">✎</button>' : ''}<button data-action="more" title="Mais">⋯</button></div>`;
    for (const b of body.querySelectorAll('[data-reaction]')) b.onclick = () => reactToMessage(m, b.dataset.reaction, isDm);
    body.querySelector('[data-action="reply"]').onclick = () => setReply(m, isDm);
    body.querySelector('[data-action="react"]').onclick = e => openReactionMenu(e.clientX, e.clientY, m, isDm);
    body.querySelector('[data-action="edit"]')?.addEventListener('click', () => beginEdit(m, isDm));
    body.querySelector('[data-action="more"]').onclick = e => openMessageMenu(e.clientX, e.clientY, m, isDm);
    row.oncontextmenu = e => { e.preventDefault(); openMessageMenu(e.clientX, e.clientY, m, isDm); };
    row.append(av, body); return row;
  }

  renderMessages = function renderMessagesV1(forceBottom = false) {
    if (!state.selectedChannel || state.selectedChannel.type !== 'text') return;
    const wasBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 90; els.messages.innerHTML = '';
    for (const m of state.messagesByChannel.get(state.selectedChannel.id) || []) els.messages.appendChild(buildMessageRow(m, false));
    if (forceBottom || wasBottom) els.messages.scrollTop = els.messages.scrollHeight;
  };
  renderDmMessages = function renderDmMessagesV1(forceBottom = false) {
    if (state.viewMode !== 'dm' || !state.activeDmUserId) return;
    const wasBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 90; els.messages.innerHTML = '';
    const arr = state.dmMessages.get(state.activeDmUserId) || [];
    for (const m of arr) els.messages.appendChild(buildMessageRow(m, true));
    if (!arr.length) els.messages.innerHTML = '<div class="dm-conversation-empty"><b>Comece a conversa 👋</b><span>As mensagens ficam armazenadas no Banana Cord do host.</span></div>';
    if (forceBottom || wasBottom) els.messages.scrollTop = els.messages.scrollHeight;
  };

  function openReactionMenu(x, y, m, isDm) { openContextMenu(x, y, [{ reactions: REACTIONS, onPick: emoji => reactToMessage(m, emoji, isDm) }]); }
  function reactToMessage(m, emoji, isDm) {
    if (isDm) state.socket.emit('dm:react', { userId: state.activeDmUserId, messageId: m.id, emoji });
    else state.socket.emit('message:react', { serverId: state.selectedServer.id, channelId: state.selectedChannel.id, messageId: m.id, emoji });
  }
  function canDeleteServerMessage(m) { return m.authorId === state.user?.id || can('moderator'); }
  function openMessageMenu(x, y, m, isDm) {
    const mine = isDm ? m.fromId === state.user?.id : m.authorId === state.user?.id;
    openContextMenu(x, y, [
      { icon: '↩', label: 'Responder', action: () => setReply(m, isDm) },
      { reactions: REACTIONS, onPick: emoji => reactToMessage(m, emoji, isDm) },
      mine && { icon: '✎', label: 'Editar mensagem', action: () => beginEdit(m, isDm) },
      (mine || (!isDm && canDeleteServerMessage(m))) && { separator: true },
      (mine || (!isDm && canDeleteServerMessage(m))) && { icon: '🗑️', label: 'Apagar mensagem', danger: true, action: () => deleteMessage(m, isDm) },
    ]);
  }
  function setReply(m, isDm) { v1.reply = { messageId: m.id, isDm, text: m.text, author: authorForMessage(m, isDm)?.name || 'Usuário' }; v1.editing = null; updateComposerBar(); els.messageInput.focus(); }
  function beginEdit(m, isDm) { v1.editing = { messageId: m.id, isDm }; v1.reply = null; els.messageInput.value = m.text || ''; updateComposerBar(); els.messageInput.focus(); els.messageInput.select(); }
  function deleteMessage(m, isDm) {
    if (!confirm('Apagar esta mensagem?')) return;
    if (isDm) state.socket.emit('dm:delete', { userId: state.activeDmUserId, messageId: m.id });
    else state.socket.emit('message:delete', { serverId: state.selectedServer.id, channelId: state.selectedChannel.id, messageId: m.id });
  }
  function ensureComposerBar() {
    let bar = $('v1ComposerBar'); if (bar) return bar;
    bar = document.createElement('div'); bar.id = 'v1ComposerBar'; bar.className = 'v1-composer-bar hidden';
    els.messageForm.parentElement.insertBefore(bar, els.messageForm); return bar;
  }
  function updateComposerBar() {
    const bar = ensureComposerBar();
    if (v1.editing) bar.innerHTML = `<span>✎ Editando mensagem</span><button id="v1CancelCompose" type="button">×</button>`;
    else if (v1.reply) bar.innerHTML = `<span>↩ Respondendo a <b>${escapeHtml(v1.reply.author)}</b>: ${escapeHtml(String(v1.reply.text || '').slice(0, 90))}</span><button id="v1CancelCompose" type="button">×</button>`;
    else { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    bar.classList.remove('hidden'); $('v1CancelCompose').onclick = clearComposerMode;
  }
  function clearComposerMode() { v1.reply = null; v1.editing = null; els.messageInput.value = ''; updateComposerBar(); }
  els.messageInput.addEventListener('keydown', e => { if (e.key === 'Escape' && (v1.reply || v1.editing)) { e.preventDefault(); clearComposerMode(); } });
  els.messageForm.addEventListener('submit', e => {
    e.preventDefault(); e.stopImmediatePropagation();
    const text = els.messageInput.value.trim(); if (!text) return;
    const isDm = state.viewMode === 'dm' && !!state.activeDmUserId;
    if (v1.editing) {
      if (isDm) state.socket.emit('dm:edit', { userId: state.activeDmUserId, messageId: v1.editing.messageId, text });
      else state.socket.emit('message:edit', { serverId: state.selectedServer.id, channelId: state.selectedChannel.id, messageId: v1.editing.messageId, text });
    } else if (isDm) state.socket.emit('dm:send', { userId: state.activeDmUserId, text, replyToId: v1.reply?.messageId || null });
    else if (state.selectedServer && state.selectedChannel?.type === 'text') state.socket.emit('message:send', { serverId: state.selectedServer.id, channelId: state.selectedChannel.id, text, replyToId: v1.reply?.messageId || null });
    els.messageInput.value = ''; v1.reply = null; v1.editing = null; updateComposerBar();
  }, true);


  // Sugestões leves de @menção (somente no canal de texto do servidor).
  function closeMentionSuggest(){ $('v1MentionSuggest')?.remove(); }
  function updateMentionSuggest(){
    closeMentionSuggest();
    if(state.viewMode!=='server'||state.selectedChannel?.type!=='text')return;
    const value=els.messageInput.value,match=value.match(/@([^@\n]{0,32})$/);if(!match)return;
    const query=match[1].toLocaleLowerCase('pt-BR').trim();
    const candidates=[...state.members.values()].filter(u=>u.id!==state.user?.id&&(!query||u.name.toLocaleLowerCase('pt-BR').includes(query))).slice(0,6);if(!candidates.length)return;
    const box=document.createElement('div');box.id='v1MentionSuggest';box.className='v1-mention-suggest';
    for(const u of candidates){const b=document.createElement('button');const av=document.createElement('span');av.className='avatar';avatarStyle(av,u);const tx=document.createElement('span');tx.innerHTML=`<b>${escapeHtml(u.name)}</b><small>${escapeHtml(u.customStatus||STATUS_LABEL[u.status||'offline']||'Offline')}</small>`;b.append(av,tx);b.onclick=e=>{e.preventDefault();const start=value.slice(0,value.length-match[0].length);els.messageInput.value=`${start}@${u.name} `;closeMentionSuggest();els.messageInput.focus()};box.appendChild(b)}
    els.messageForm.appendChild(box);
  }
  els.messageInput.addEventListener('input',updateMentionSuggest);
  els.messageInput.addEventListener('blur',()=>setTimeout(closeMentionSuggest,180));

  // ---------- Amigos / membros / DMs ----------
  function relationLabel(id) {
    if (isBlocked(id)) return 'Bloqueado'; if (isFriend(id)) return 'Amigo'; if (isIncoming(id)) return 'Solicitação recebida'; if (isOutgoing(id)) return 'Solicitação enviada'; return '';
  }
  function memberActions(userId) {
    const u = currentPeer(userId); if (!u || userId === state.user?.id) return [];
    const blocked = isBlocked(userId), friend = isFriend(userId), incoming = isIncoming(userId), outgoing = isOutgoing(userId);
    const items = [];
    if (!blocked) items.push({ icon: '💬', label: 'Mensagem privada', action: () => startDm(userId, u) });
    if (incoming) {
      items.push({ icon: '✅', label: 'Aceitar amizade', action: () => state.socket.emit('friend:accept', { userId }) });
      items.push({ icon: '✖', label: 'Recusar solicitação', action: () => state.socket.emit('friend:reject', { userId }) });
    } else if (friend) items.push({ icon: '👤', label: 'Remover amigo', action: () => { if (confirm(`Remover ${u.name} dos amigos?`)) state.socket.emit('friend:remove', { userId }); } });
    else if (!outgoing && !blocked) items.push({ icon: '➕', label: 'Adicionar amigo', action: () => state.socket.emit('friend:request', { userId }) });
    else if (outgoing) items.push({ icon: '⌛', label: 'Solicitação enviada', disabled: true });
    items.push({ separator: true });
    items.push({ icon: '🔊', label: 'Volume deste usuário…', action: () => openMemberVolume(userId, u) });
    const volume = peerVolume(userId);
    items.push(volume > 0 ? { icon: '🔇', label: 'Mutar localmente', action: () => { v1.lastVolumes[userId] = volume; state.media.peerVolumes[userId] = 0; writeJson('lastPeerVolumes', v1.lastVolumes); savePrefs(); refreshAllOutputs(); } } : { icon: '🔊', label: 'Desmutar localmente', action: () => { state.media.peerVolumes[userId] = Number(v1.lastVolumes[userId] ?? 1); savePrefs(); refreshAllOutputs(); } });
    items.push({ icon: '👁', label: 'Ver perfil', action: () => openMemberProfile(userId) });
    items.push({ separator: true });
    items.push(blocked ? { icon: '🔓', label: 'Desbloquear', action: () => state.socket.emit('friend:unblock', { userId }) } : { icon: '⛔', label: 'Bloquear', danger: true, action: () => { if (confirm(`Bloquear ${u.name}? Essa pessoa não poderá enviar DMs ou solicitações de amizade.`)) state.socket.emit('friend:block', { userId }); } });
    if (state.viewMode === 'server' && currentRole() === 'owner' && state.selectedServer && userId !== state.selectedServer.ownerId) items.push({ icon: '🚪', label: 'Expulsar do servidor', danger: true, action: () => { if (confirm(`Remover ${u.name} deste servidor?`)) state.socket.emit('member:kick', { serverId: state.selectedServer.id, userId }); } });
    return items;
  }
  function openMemberMenu(x, y, userId) { const items = memberActions(userId); if (items.length) openContextMenu(x, y, items); }
  function openMemberVolume(userId, u) {
    const current = Math.round(peerVolume(userId) * 100);
    openModal(`<h2>Volume de ${escapeHtml(u?.name || 'usuário')}</h2><label>Volume <span id="v1MemberVolumeLabel">${current}%</span></label><input id="v1MemberVolume" type="range" min="0" max="100" value="${current}"><button id="v1SaveMemberVolume" class="action">Salvar</button>`);
    $('v1MemberVolume').oninput = e => $('v1MemberVolumeLabel').textContent = `${e.target.value}%`;
    $('v1SaveMemberVolume').onclick = () => { state.media.peerVolumes[userId] = Number($('v1MemberVolume').value) / 100; savePrefs(); refreshAllOutputs(); closeModal(); };
  }

  renderMembers = function renderMembersV1() {
    els.memberList.innerHTML = '';
    const arr = [...state.members.values()].sort((a, b) => (b.status === 'online') - (a.status === 'online') || (ROLE_RANK[b.role || 'member'] - ROLE_RANK[a.role || 'member']) || a.name.localeCompare(b.name));
    for (const u of arr) {
      const role = u.role || roleFor(u.id), row = document.createElement('div'); row.className = `member${u.status === 'offline' ? ' offline' : ''}${isFriend(u.id) ? ' friend' : ''}`; row.dataset.userId = u.id;
      const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, u);
      const tx = document.createElement('div'); tx.className = 'member-name';
      const sub = u.customStatus || `${STATUS_LABEL[u.status || 'offline'] || 'Offline'} · ${ROLE_LABEL[role]}`;
      tx.innerHTML = `<b class="role-color-${role}">${escapeHtml(u.name)}${role === 'owner' ? ' 👑' : ''}${isFriend(u.id) ? ' · <span class="v1-friend-mark">amigo</span>' : ''}</b><small><span class="status-dot status-${escapeHtml(u.status || 'offline')}"></span>${escapeHtml(sub)}</small>`;
      row.append(av, tx); row.onclick = () => openMemberProfile(u.id); row.oncontextmenu = e => { e.preventDefault(); openMemberMenu(e.clientX, e.clientY, u.id); }; els.memberList.appendChild(row);
    }
  };

  openMemberProfile = function openMemberProfileV1(userId) {
    const u = currentPeer(userId); if (!u) return; const role = state.members.has(userId) ? (state.members.get(userId).role || roleFor(userId)) : 'member'; const mine = userId === state.user?.id;
    const rel = !mine ? relationLabel(userId) : '';
    openModal(`<h2>${escapeHtml(u.name)}</h2><div class="profile-preview"><div id="profilePreviewAvatar" class="avatar" style="width:76px;height:76px;font-size:28px"></div><p><span class="status-dot status-${escapeHtml(u.status || 'offline')}"></span>${STATUS_LABEL[u.status || 'offline'] || 'Offline'}${u.customStatus ? ` · ${escapeHtml(u.customStatus)}` : ''}</p>${state.members.has(userId) ? `<span class="role-badge role-${role}">${ROLE_LABEL[role]}</span>` : ''}${rel ? `<span class="v1-relation-badge">${escapeHtml(rel)}</span>` : ''}<div id="v1ProfileActions" class="v1-profile-actions"></div></div>`);
    avatarStyle($('profilePreviewAvatar'), u);
    const actions = $('v1ProfileActions');
    for (const item of memberActions(userId).filter(x => x && !x.separator && !x.disabled).slice(0, 4)) { const b = document.createElement('button'); b.className = item.danger ? 'danger-action' : 'secondary'; b.textContent = `${item.icon || ''} ${item.label}`; b.onclick = () => { closeModal(); item.action?.(); }; actions.appendChild(b); }
  };

  function openFriendsPanel() {
    const f = v1.social.friends, incoming = v1.social.incoming, outgoing = v1.social.outgoing, blocked = v1.social.blocked;
    const row = (u, actions) => `<div class="v1-social-row"><span class="avatar v1-social-avatar" data-user="${escapeHtml(u.id)}"></span><span><b>${escapeHtml(u.name)}</b><small>${escapeHtml(u.customStatus || STATUS_LABEL[u.status || 'offline'] || 'Offline')}</small></span><span>${actions}</span></div>`;
    openModal(`<div class="simple-modal-head"><h2>Amigos</h2><p>Gerencie amizades, solicitações e bloqueios.</p></div><div class="v1-social-section"><h3>Amigos (${f.length})</h3>${f.map(u => row(u, `<button data-dm="${u.id}">💬</button><button data-remove="${u.id}">Remover</button>`)).join('') || '<small>Nenhum amigo adicionado ainda.</small>'}</div><div class="v1-social-section"><h3>Solicitações recebidas (${incoming.length})</h3>${incoming.map(u => row(u, `<button data-accept="${u.id}">Aceitar</button><button data-reject="${u.id}">Recusar</button>`)).join('') || '<small>Nenhuma solicitação pendente.</small>'}</div><div class="v1-social-section"><h3>Enviadas (${outgoing.length})</h3>${outgoing.map(u => row(u, '<small>Aguardando resposta</small>')).join('') || '<small>Nenhuma.</small>'}</div><div class="v1-social-section"><h3>Bloqueados (${blocked.length})</h3>${blocked.map(u => row(u, `<button data-unblock="${u.id}">Desbloquear</button>`)).join('') || '<small>Ninguém bloqueado.</small>'}</div>`);
    for (const av of document.querySelectorAll('.v1-social-avatar')) avatarStyle(av, currentPeer(av.dataset.user));
    for (const b of document.querySelectorAll('[data-dm]')) b.onclick = () => { const id = b.dataset.dm, u = currentPeer(id); closeModal(); startDm(id, u); };
    for (const b of document.querySelectorAll('[data-remove]')) b.onclick = () => state.socket.emit('friend:remove', { userId: b.dataset.remove });
    for (const b of document.querySelectorAll('[data-accept]')) b.onclick = () => state.socket.emit('friend:accept', { userId: b.dataset.accept });
    for (const b of document.querySelectorAll('[data-reject]')) b.onclick = () => state.socket.emit('friend:reject', { userId: b.dataset.reject });
    for (const b of document.querySelectorAll('[data-unblock]')) b.onclick = () => state.socket.emit('friend:unblock', { userId: b.dataset.unblock });
  }

  const startDmBase = startDm;
  startDm = function startDmV1(userId, user = null) { if (isBlocked(userId)) return toast('Desbloqueie essa pessoa antes de abrir a conversa.'); startDmBase(userId, user); };
  function dmSort(conversations) { return [...conversations].sort((a, b) => Number(v1.pinnedDms.has(b.user?.id)) - Number(v1.pinnedDms.has(a.user?.id)) || Number(b.lastMessage?.at || 0) - Number(a.lastMessage?.at || 0)); }
  renderDmSidebar = function renderDmSidebarV1() {
    if (state.viewMode !== 'dm') return; els.channels.innerHTML = '';
    const top = document.createElement('div'); top.className = 'dm-sidebar';
    top.innerHTML = `<div class="channel-section-title"><span>MENSAGENS PRIVADAS</span></div><div class="v1-dm-tools"><button id="v1FriendsBtn">👥 Amigos${v1.social.incoming.length ? ` <span class="v1-small-badge">${v1.social.incoming.length}</span>` : ''}</button><button id="newDmBtn">＋ Nova mensagem</button></div><div id="v1FriendQuick" class="v1-friend-quick"></div><div class="channel-section-title v1-recent-title"><span>RECENTES</span></div><div id="dmConversationList" class="dm-conversation-list"></div>`;
    els.channels.appendChild(top); $('v1FriendsBtn').onclick = openFriendsPanel; $('newDmBtn').onclick = openNewDmModal;
    const fq = $('v1FriendQuick');
    for (const u of v1.social.friends.slice(0, 8)) {
      const b = document.createElement('button'); b.className = 'v1-friend-quick-row'; const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, u); b.innerHTML = `<span><b>${escapeHtml(u.name)}</b><small>${escapeHtml(u.customStatus || STATUS_LABEL[u.status || 'offline'] || 'Offline')}</small></span>`; b.prepend(av); b.onclick = () => startDm(u.id, u); b.oncontextmenu = e => { e.preventDefault(); openMemberMenu(e.clientX, e.clientY, u.id); }; fq.appendChild(b);
    }
    const list = $('dmConversationList');
    for (const c of dmSort(state.dmConversations).filter(c => !isBlocked(c.user?.id))) {
      const u = c.user; if (!u?.id) continue; const row = document.createElement('button'); row.className = `dm-row${state.activeDmUserId === u.id ? ' active' : ''}`;
      const av = document.createElement('div'); av.className = 'avatar'; avatarStyle(av, u); const txt = document.createElement('div'); txt.className = 'dm-row-text'; txt.innerHTML = `<b>${v1.pinnedDms.has(u.id) ? '📌 ' : ''}${escapeHtml(u.name || 'Amigo')}</b><small>${escapeHtml(c.lastMessage?.text || 'Iniciar conversa')}</small>`;
      const meta = document.createElement('div'); meta.className = 'dm-row-meta'; meta.innerHTML = `<span class="status-dot status-${escapeHtml(u.status || 'offline')}"></span>${state.dmUnread.has(u.id) ? '<span class="dm-unread-dot"></span>' : ''}`;
      row.append(av, txt, meta); row.onclick = () => startDm(u.id, u); row.oncontextmenu = e => { e.preventDefault(); openDmMenu(e.clientX, e.clientY, u); }; list.appendChild(row);
    }
    if (!list.children.length) list.innerHTML = '<div class="dm-empty-list">Nenhuma conversa recente.</div>';
  };
  function openDmMenu(x, y, u) {
    const pinned = v1.pinnedDms.has(u.id);
    openContextMenu(x, y, [
      { icon: '💬', label: 'Abrir conversa', action: () => startDm(u.id, u) },
      { icon: '📌', label: pinned ? 'Desafixar conversa' : 'Fixar conversa', action: () => { pinned ? v1.pinnedDms.delete(u.id) : v1.pinnedDms.add(u.id); writeJson('pinnedDms', [...v1.pinnedDms]); renderDmSidebar(); } },
      { separator: true },
      ...memberActions(u.id).filter(x => x && !x.separator).slice(-2),
    ]);
  }
  openNewDmModal = function openNewDmModalV1() {
    const map = new Map(); for (const u of v1.social.friends) map.set(u.id, u); for (const u of state.members.values()) if (u.id !== state.user?.id) map.set(u.id, u);
    const candidates = [...map.values()].filter(u => !isBlocked(u.id));
    openModal(`<div class="simple-modal-head"><h2>Nova mensagem</h2><p>Escolha um amigo ou alguém do servidor atual.</p></div><div class="dm-picker">${candidates.map(u => `<button class="dm-picker-row" data-user="${escapeHtml(u.id)}"><span class="dm-picker-avatar avatar" data-avatar="${escapeHtml(u.id)}"></span><span><b>${escapeHtml(u.name)}</b><small>${isFriend(u.id) ? 'Amigo · ' : ''}${STATUS_LABEL[u.status || 'offline'] || 'Offline'}</small></span></button>`).join('') || '<p>Ninguém disponível.</p>'}</div>`);
    for (const av of document.querySelectorAll('.dm-picker-avatar')) avatarStyle(av, currentPeer(av.dataset.avatar)); for (const b of document.querySelectorAll('.dm-picker-row')) b.onclick = () => { const u = currentPeer(b.dataset.user); closeModal(); startDm(b.dataset.user, u); };
  };

  // Duplo clique em qualquer sala de voz, inclusive se a sidebar for redesenhada depois.
  els.channels.addEventListener('dblclick', async e => {
    const row = e.target.closest('.channel-row'); if (!row || !state.selectedServer) return;
    const c = state.selectedServer.channels.find(x => x.id === row.dataset.channelId); if (!c || c.type !== 'voice') return;
    e.preventDefault(); selectChannel(c.id); await joinVoice(c);
  });

  // Atualiza a versão exibida na tela inicial sem tocar no app principal.
  const setupVersion = document.querySelector('.setup .brand p b'); if (setupVersion) setupVersion.textContent = 'v1.0 · pós-beta';
  ensureComposerBar();
})();
