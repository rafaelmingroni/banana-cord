/* Mingrx Social Hub — replaces the legacy friends modal without changing backend events. */
(() => {
  if (window.__mingrxSocialPolishLoaded) return;
  window.__mingrxSocialPolishLoaded = true;

  const $id = id => document.getElementById(id);
  const searchProfiles=new Map();
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function socialState() {
    const source = state?.v1?.social || {};
    return {
      friends: Array.isArray(source.friends) ? source.friends : [],
      incoming: Array.isArray(source.incoming) ? source.incoming : [],
      outgoing: Array.isArray(source.outgoing) ? source.outgoing : [],
      blocked: Array.isArray(source.blocked) ? source.blocked : []
    };
  }

  function peerById(id) {
    const social = socialState();
    return ['friends','incoming','outgoing','blocked'].flatMap(key => social[key]).find(user => user?.id === id)
      || state?.dmConversations?.find?.(row => row?.user?.id === id)?.user
      || state?.members?.get?.(id)
      || searchProfiles.get(id)
      || null;
  }

  function statusText(user) {
    return user?.customStatus || (typeof STATUS_LABEL !== 'undefined' && STATUS_LABEL[user?.status || 'offline']) || 'Offline';
  }

  function avatarHtml(user) {
    return `<span class="avatar mingrx-social-avatar" data-social-avatar="${esc(user?.id || '')}" data-social-status="${esc(user?.status||'offline')}"></span>`;
  }

  function actionButton(label, attrs = '', extra = '') {
    return `<button type="button" class="mingrx-social-action ${extra}" ${attrs}>${label}</button>`;
  }

  function accountLabel(user){
    const id=String(user.id||'');
    const social=socialState();
    const others=[...Object.values(social).flat(),...searchProfiles.values()].filter(peer=>peer.id!==id);
    let length=Math.min(8,id.length);
    while(length<id.length&&others.some(peer=>String(peer.id).endsWith(id.slice(-length))))length++;
    return `ID · ${id.slice(-length)}`;
  }

  function rowHtml(user, kind) {
    let actions = '';
    if (kind === 'friends') {
      actions = `${actionButton('💬', `data-mx-dm="${esc(user.id)}" aria-label="Abrir conversa" title="Abrir conversa"`, 'icon-only')}${actionButton('Remover', `data-mx-remove="${esc(user.id)}"`)}`;
    } else if (kind === 'incoming') {
      actions = `${actionButton('Aceitar', `data-mx-accept="${esc(user.id)}"`, 'primary')}${actionButton('Recusar', `data-mx-reject="${esc(user.id)}"`)}`;
    } else if (kind === 'outgoing') {
      actions = '<span class="mingrx-social-waiting">Aguardando resposta</span>';
    } else if (kind === 'blocked') {
      actions = actionButton('Desbloquear', `data-mx-unblock="${esc(user.id)}"`);
    } else if (kind === 'search') {
      actions = actionButton('Adicionar', `data-mx-add="${esc(user.id)}"`, 'primary');
    }
    return `<div class="mingrx-social-row" data-social-user="${esc(user.id)}">${avatarHtml(user)}<span class="mingrx-social-copy" data-user-content><b>${esc(user.name || 'Usuário')}</b><span class="mingrx-social-identity"><code title="ID completo da conta: ${esc(user.id)}">${esc(accountLabel(user))}</code><button type="button" data-mx-copy-id="${esc(user.id)}" title="Copiar ID completo da conta" aria-label="Copiar ID da conta de ${esc(user.name || 'Usuário')}">⧉</button></span><small>${esc(statusText(user))}</small></span><span class="mingrx-social-actions">${actions}</span></div>`;
  }

  function emptyHtml(title, copy) {
    return `<div class="mingrx-social-empty"><div><b>${esc(title)}</b><span>${esc(copy)}</span></div></div>`;
  }

  function hydrateAvatars(root = document) {
    for (const node of root.querySelectorAll?.('[data-social-avatar]') || []) {
      if (node.dataset.socialAvatarHydrated === 'true') continue;
      const user = peerById(node.dataset.socialAvatar);
      if (user && typeof avatarStyle === 'function') {
        avatarStyle(node, user);
        node.dataset.socialAvatarHydrated = 'true';
      }
    }
  }

  function bindSocialSocket(socket) {
    if (!socket?.on || socket.__mingrxSocialPolishBound) return;
    socket.__mingrxSocialPolishBound = true;
    socket.on('social:state', () => setTimeout(refreshCurrentTab, 0));
  }

  function emit(event, payload, callback) {
    const socket = state?.socket;
    bindSocialSocket(socket);
    if (!socket?.emit) return callback?.({ ok:false, message:'Mingrx Cloud indisponível no momento.' });
    socket.emit(event, payload, callback);
  }

  let activeTab = 'friends';

  function tabButton(key, label, count, active) {
    return `<button type="button" role="tab" aria-selected="${active}" class="mingrx-social-tab${active ? ' active' : ''}" data-mx-tab="${key}">${label}<span class="mingrx-social-tab-count">${count}</span></button>`;
  }

  function openSocialHub(tab = 'friends') {
    bindSocialSocket(state?.socket);
    activeTab = tab;
    const social = socialState();
    const incomingCount = social.incoming.length;
    openModal(`
      <div class="mingrx-social-hub">
        <div class="mingrx-social-head">
          <div><h2>Amigos</h2><p>Suas pessoas, por perto.</p></div>
          <button type="button" class="mingrx-social-add-button" data-mx-tab="add">＋ Adicionar amigo</button>
        </div>
        <div class="mingrx-social-tabs" role="tablist" aria-label="Amigos">
          ${tabButton('friends','Amigos',social.friends.length,tab === 'friends')}
          ${tabButton('incoming','Solicitações',incomingCount,tab === 'incoming')}
          ${tabButton('outgoing','Enviadas',social.outgoing.length,tab === 'outgoing')}
          ${tabButton('blocked','Bloqueados',social.blocked.length,tab === 'blocked')}
        </div>
        <div id="mingrxSocialBody" class="mingrx-social-body"></div>
      </div>`);
    renderTab(tab);
  }

  function renderTab(tab) {
    activeTab = tab;
    const body = $id('mingrxSocialBody');
    if (!body) return;
    const social = socialState();
    for (const button of document.querySelectorAll('.mingrx-social-tab')) {
      button.classList.toggle('active', button.dataset.mxTab === tab);
      button.setAttribute('aria-selected',String(button.dataset.mxTab === tab));
    }
    const counts={friends:social.friends.length,incoming:social.incoming.length,outgoing:social.outgoing.length,blocked:social.blocked.length};
    for(const button of document.querySelectorAll('.mingrx-social-tab'))button.querySelector('.mingrx-social-tab-count').textContent=counts[button.dataset.mxTab];

    if (tab === 'add') {
      body.innerHTML = `
        <div class="mingrx-add-friend">
          <div class="mingrx-add-friend-copy"><h3>Adicionar amigo</h3><p>Procure pelo nome de usuário. A pessoa não precisa estar na mesma comunidade.</p></div>
          <div class="mingrx-add-friend-form"><input id="mingrxFriendQuery" maxlength="32" autocomplete="off" placeholder="Nome do usuário"><button id="mingrxFriendSearch" type="button">Buscar</button></div>
          <div id="mingrxFriendResults" class="mingrx-add-friend-results">${emptyHtml('Encontre alguém no Mingrx','Digite um nome acima para começar a busca.')}</div>
        </div>`;
      const input = $id('mingrxFriendQuery');
      const search = () => searchUsers(input?.value || '');
      $id('mingrxFriendSearch')?.addEventListener('click', search);
      input?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
      setTimeout(() => input?.focus(), 0);
      return;
    }

    const config = {
      friends: ['Seus amigos', social.friends, 'Nenhum amigo ainda', 'Use “Adicionar” para procurar alguém pelo nome.'],
      incoming: ['Solicitações recebidas', social.incoming, 'Nenhuma solicitação pendente', 'Quando alguém quiser adicionar você, vai aparecer aqui.'],
      outgoing: ['Solicitações enviadas', social.outgoing, 'Nenhuma solicitação enviada', 'As solicitações que aguardam resposta aparecem aqui.'],
      blocked: ['Pessoas bloqueadas', social.blocked, 'Ninguém bloqueado', 'Contas bloqueadas não podem enviar mensagens ou solicitações.']
    }[tab] || null;
    if (!config) return renderTab('friends');
    const [title, users, emptyTitle, emptyCopy] = config;
    body.innerHTML = `<section class="mingrx-social-section"><div class="mingrx-social-section-head"><h3>${title}</h3><small>${users.length} ${users.length === 1 ? 'pessoa' : 'pessoas'}</small></div><div class="mingrx-social-list">${users.length ? users.map(user => rowHtml(user, tab)).join('') : emptyHtml(emptyTitle, emptyCopy)}</div></section>`;
    hydrateAvatars(body);
  }

  function searchUsers(rawQuery) {
    const query = String(rawQuery || '').trim();
    const results = $id('mingrxFriendResults');
    const button = $id('mingrxFriendSearch');
    if (!results || !query) return;
    if (button) button.disabled = true;
    results.innerHTML = emptyHtml('Procurando…','Buscando pessoas no Mingrx Cloud.');
    emit('friend:search', { query }, response => {
      if (button) button.disabled = false;
      if (!response?.ok) {
        results.innerHTML = emptyHtml('Não foi possível buscar', response?.message || 'Tente novamente em alguns instantes.');
        return;
      }
      const users = Array.isArray(response.users) ? response.users : [];
      searchProfiles.clear();for(const user of users)searchProfiles.set(user.id,user);
      results.innerHTML = users.length ? users.map(user => rowHtml(user, 'search')).join('') : emptyHtml('Nenhum usuário encontrado','Tente conferir o nome e buscar novamente.');
      hydrateAvatars(results);
    });
  }

  function refreshCurrentTab() {
    if (!$id('mingrxSocialBody')) return;
    renderTab(activeTab);
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const tab = target.closest('[data-mx-tab]');
    if (tab) { event.preventDefault(); renderTab(tab.dataset.mxTab); return; }
    const copyId=target.closest('[data-mx-copy-id]');
    if(copyId){
      ipcRenderer.invoke('clipboard:write',copyId.dataset.mxCopyId).then(()=>toast('ID da conta copiado.')).catch(()=>toast('Não foi possível copiar o ID.'));
      return;
    }

    const friendsTrigger = target.closest('#v1FriendsBtn,.v214-private-request,#v214HomeFriends,[data-mingrx-open-friends]');
    if (friendsTrigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openSocialHub(friendsTrigger.classList.contains('v214-private-request') ? 'incoming' : 'friends');
      return;
    }

    const legacyAdd = target.closest('#v207AddFriendBtn,#v207StartFriend,#v214HomeFriend');
    if (legacyAdd) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openSocialHub('add');
      return;
    }

    const dm = target.closest('[data-mx-dm]');
    if (dm) {
      const user = peerById(dm.dataset.mxDm);
      if (user && typeof startDm === 'function') { closeModal(); startDm(user.id, user); }
      return;
    }
    const remove = target.closest('[data-mx-remove]');
    if (remove) {
      const user = peerById(remove.dataset.mxRemove);
      if (!user || confirm(`Remover ${user.name || 'este usuário'} dos amigos?`)) emit('friend:remove', { userId: remove.dataset.mxRemove });
      return;
    }
    const accept = target.closest('[data-mx-accept]');
    if (accept) { emit('friend:accept', { userId: accept.dataset.mxAccept }); return; }
    const reject = target.closest('[data-mx-reject]');
    if (reject) { emit('friend:reject', { userId: reject.dataset.mxReject }); return; }
    const unblock = target.closest('[data-mx-unblock]');
    if (unblock) { emit('friend:unblock', { userId: unblock.dataset.mxUnblock }); return; }
    const add = target.closest('[data-mx-add]');
    if (add) {
      add.disabled = true;
      emit('friend:request', { userId: add.dataset.mxAdd }, response => {
        if (response?.ok === false) {
          add.disabled = false;
          if (typeof toast === 'function') toast(response.message || 'Não consegui enviar a solicitação.', 4200);
          return;
        }
        add.textContent = 'Enviado ✓';
        if (typeof toast === 'function') toast('Solicitação enviada.');
      });
    }
  }, true);

  if (state?.socket) bindSocialSocket(state.socket);

  window.MingrxOpenFriends = openSocialHub;
  window.BananaOpenFriendSearch = () => openSocialHub('add');
})();
