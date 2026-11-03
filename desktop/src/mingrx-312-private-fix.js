/* Mingrx 3.1.2 — fresh-DM permission repair + private sidebar polish. */
(() => {
  if (window.__mingrx312PrivateFixLoaded) return;
  window.__mingrx312PrivateFixLoaded = true;

  const { doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');
  const HIDDEN_RECENTS_KEY = 'mingrx.hiddenDmRecents.v1';

  const style = document.createElement('style');
  style.textContent = `
    body.mingrx-ui .mingrx312-private-sidebar{padding-top:8px!important}
    body.mingrx-ui .mingrx312-private-sidebar>.channel-section-title:not(.v1-recent-title),
    body.mingrx-ui .mingrx312-private-sidebar>.v1-dm-tools,
    body.mingrx-ui .mingrx312-private-sidebar>#v1FriendQuick,
    body.mingrx-ui .mingrx312-private-sidebar>#v1FriendQuick + *{display:none!important}
    body.mingrx-ui .mingrx312-private-sidebar .v214-private-section-title:not(.v1-recent-title){display:none!important}
    body.mingrx-ui .mingrx312-private-nav{display:flex;flex-direction:column;gap:5px;margin:0 0 12px}
    body.mingrx-ui .mingrx312-private-nav button{width:100%;min-height:43px;display:flex;align-items:center;gap:11px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--mx-text,#e7edf6);padding:0 12px;font-size:13px;font-weight:800;text-align:left;cursor:pointer;transition:background .14s,border-color .14s,transform .14s}
    body.mingrx-ui .mingrx312-private-nav button:hover{background:color-mix(in srgb,var(--mx-accent,#5b8cff) 11%,transparent);border-color:color-mix(in srgb,var(--mx-accent,#5b8cff) 22%,transparent)}
    body.mingrx-ui .mingrx312-private-nav button.active{background:linear-gradient(90deg,color-mix(in srgb,var(--mx-accent,#5b8cff) 30%,#151b25),color-mix(in srgb,var(--mx-accent,#5b8cff) 14%,#151b25));border-color:color-mix(in srgb,var(--mx-accent,#5b8cff) 34%,transparent);box-shadow:inset 3px 0 0 var(--mx-accent,#5b8cff)}
    body.mingrx-ui .mingrx312-private-nav .mingrx312-nav-icon{width:22px;text-align:center;font-size:16px;line-height:1}
    body.mingrx-ui .mingrx312-private-sidebar .v214-private-intro{order:0;position:relative;margin:0 0 16px;padding:15px 14px 15px 55px!important;min-height:72px;border:1px solid color-mix(in srgb,var(--mx-accent,#5b8cff) 36%,#273244)!important;border-radius:14px!important;background:radial-gradient(circle at 100% 100%,color-mix(in srgb,var(--mx-accent,#5b8cff) 25%,transparent),transparent 42%),linear-gradient(135deg,color-mix(in srgb,var(--mx-accent,#5b8cff) 14%,#111a25),#111923)!important;box-shadow:0 10px 28px #0003!important;overflow:hidden}
    body.mingrx-ui .mingrx312-private-sidebar .v214-private-intro::before{content:'👥';position:absolute;left:14px;top:15px;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:color-mix(in srgb,var(--mx-accent,#5b8cff) 22%,#172131);font-size:16px}
    body.mingrx-ui .mingrx312-private-sidebar .v214-private-intro b{font-size:13px!important;color:#f3f7ff!important;margin-bottom:4px!important}
    body.mingrx-ui .mingrx312-private-sidebar .v214-private-intro span{font-size:10.5px!important;color:#a7b3c5!important;line-height:1.45!important}
    body.mingrx-ui .mingrx312-private-sidebar .v1-recent-title{display:flex!important;margin:2px 5px 7px!important;color:#8194ad!important;font-size:9px!important;letter-spacing:.11em!important}
    body.mingrx-ui .mingrx312-private-sidebar .dm-conversation-list{display:flex!important;flex-direction:column!important;gap:5px!important}
    body.mingrx-ui .mingrx312-recent-item{position:relative;display:flex;align-items:stretch;min-width:0}
    body.mingrx-ui .mingrx312-recent-item>.dm-row{flex:1;min-width:0;padding-right:38px!important;min-height:55px!important;border-radius:11px!important;background:transparent;border:1px solid transparent!important}
    body.mingrx-ui .mingrx312-recent-item>.dm-row:hover{background:#ffffff08!important;border-color:#ffffff0d!important}
    body.mingrx-ui .mingrx312-recent-item>.dm-row.active{background:color-mix(in srgb,var(--mx-accent,#5b8cff) 20%,#101923)!important;border-color:color-mix(in srgb,var(--mx-accent,#5b8cff) 42%,transparent)!important;box-shadow:inset 3px 0 0 var(--mx-accent,#5b8cff)!important}
    body.mingrx-ui .mingrx312-recent-remove{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:#77879a;font-size:17px;line-height:1;cursor:pointer;opacity:.78;z-index:3;transition:opacity .12s,background .12s,color .12s}
    body.mingrx-ui .mingrx312-recent-remove:hover{opacity:1;background:#ffffff10;color:#e7edf6}
  `;
  document.head.appendChild(style);

  function pairId(a, b) {
    return [String(a || ''), String(b || '')].sort().join('_');
  }

  function readHiddenRecents() {
    try {
      const value = JSON.parse(localStorage.getItem(HIDDEN_RECENTS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function writeHiddenRecents(value) {
    try { localStorage.setItem(HIDDEN_RECENTS_KEY, JSON.stringify(value || {})); } catch {}
  }

  function lastAt(conversation) {
    return Number(conversation?.lastMessage?.at || 0) || 0;
  }

  function orderedConversations() {
    const blocked = new Set((state?.v1?.social?.blocked || []).map(user => String(user?.id || '')));
    const pinned = state?.v1?.pinnedDms;
    return [...(state.dmConversations || [])]
      .filter(conversation => conversation?.user?.id && !blocked.has(String(conversation.user.id)))
      .sort((a, b) => Number(!!pinned?.has?.(b.user.id)) - Number(!!pinned?.has?.(a.user.id)) || lastAt(b) - lastAt(a));
  }

  function hideRecent(userId, conversation) {
    const hidden = readHiddenRecents();
    hidden[String(userId)] = Math.max(Date.now(), lastAt(conversation));
    writeHiddenRecents(hidden);
  }

  function recentIsHidden(conversation, hidden) {
    const userId = String(conversation?.user?.id || '');
    const hiddenAt = Number(hidden[userId] || 0);
    if (!hiddenAt) return false;
    const newest = lastAt(conversation);
    if (newest > hiddenAt) {
      delete hidden[userId];
      return false;
    }
    return true;
  }

  function ensurePrivateNav(sidebar) {
    let nav = sidebar.querySelector(':scope > .mingrx312-private-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'mingrx312-private-nav';
      nav.innerHTML = `
        <button type="button" class="active" data-mingrx312-nav="messages"><span class="mingrx312-nav-icon">💬</span><span>Mensagens privadas</span></button>
        <button type="button" data-mingrx312-nav="friends"><span class="mingrx312-nav-icon">👥</span><span>Amigos</span></button>
        <button type="button" data-mingrx312-nav="add"><span class="mingrx312-nav-icon">👤+</span><span>Adicionar amigo</span></button>`;
      nav.querySelector('[data-mingrx312-nav="messages"]').onclick = () => {
        if (typeof showDmHome === 'function') showDmHome();
      };
      nav.querySelector('[data-mingrx312-nav="friends"]').onclick = () => document.getElementById('v1FriendsBtn')?.click();
      nav.querySelector('[data-mingrx312-nav="add"]').onclick = () => {
        const add = document.getElementById('v207AddFriendBtn');
        if (add) add.click();
        else window.BananaOpenFriendSearch?.();
      };
      sidebar.prepend(nav);
    }
    return nav;
  }

  function polishIntro(sidebar, nav) {
    const intro = sidebar.querySelector('.v214-private-intro');
    if (!intro) return;
    intro.innerHTML = '<b>Seu espaço privado</b><span>Converse diretamente com seus amigos, adicione novos contatos e gerencie suas amizades.</span>';
    if (intro.previousElementSibling !== nav) nav.insertAdjacentElement('afterend', intro);
  }

  function hideFriendQuick(sidebar) {
    const quick = sidebar.querySelector('#v1FriendQuick');
    if (!quick) return;
    quick.hidden = true;
    const heading = quick.previousElementSibling;
    if (heading?.classList?.contains('v214-private-section-title') && !heading.classList.contains('v1-recent-title')) heading.hidden = true;
  }

  function decorateRecents(sidebar) {
    const list = sidebar.querySelector('#dmConversationList');
    if (!list) return;
    const conversations = orderedConversations();
    const hidden = readHiddenRecents();
    let hiddenChanged = false;
    const rows = [...list.querySelectorAll(':scope > .dm-row')];

    rows.forEach((row, index) => {
      const conversation = conversations[index];
      const userId = String(conversation?.user?.id || '');
      if (!conversation || !userId) return;
      const wasHidden = Object.prototype.hasOwnProperty.call(hidden, userId);
      if (recentIsHidden(conversation, hidden)) {
        row.remove();
        return;
      }
      if (wasHidden && !Object.prototype.hasOwnProperty.call(hidden, userId)) hiddenChanged = true;

      const wrapper = document.createElement('div');
      wrapper.className = 'mingrx312-recent-item';
      wrapper.dataset.userId = userId;
      row.dataset.userId = userId;
      row.replaceWith(wrapper);
      wrapper.appendChild(row);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'mingrx312-recent-remove';
      remove.title = 'Remover dos recentes';
      remove.setAttribute('aria-label', `Remover ${conversation.user?.name || 'conversa'} dos recentes`);
      remove.textContent = '×';
      remove.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        hideRecent(userId, conversation);
        wrapper.remove();
        try { toast?.('Conversa removida dos recentes. O histórico continua salvo.', 3000); } catch {}
      };
      wrapper.appendChild(remove);
    });

    if (hiddenChanged) writeHiddenRecents(hidden);
  }

  function decoratePrivateSidebar() {
    if (state.viewMode !== 'dm') return;
    const sidebar = document.querySelector('.v214-private-sidebar,.dm-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('mingrx312-private-sidebar');
    const nav = ensurePrivateNav(sidebar);
    polishIntro(sidebar, nav);
    hideFriendQuick(sidebar);
    decorateRecents(sidebar);
  }

  async function ensureFriendThread(socket, peerId) {
    const uid = String(socket?.user?.uid || '');
    const otherUid = String(peerId || '');
    if (!socket?.db || !uid || !otherUid || uid === otherUid) return;

    const relation = typeof socket.relation === 'function' ? await socket.relation(otherUid) : null;
    const relationData = relation?.exists?.() ? relation.data() : null;
    if (!relationData || relationData.status !== 'friends' || !(relationData.participants || []).includes(uid)) {
      throw new Error('Adicione esta pessoa como amigo antes de iniciar uma conversa privada.');
    }

    const tid = pairId(uid, otherUid);
    const threadRef = doc(socket.db, 'dmThreads', tid);
    const existing = await getDoc(threadRef);
    if (!existing.exists()) {
      await setDoc(threadRef, {
        participants: [uid, otherUid].sort(),
        updatedAt: serverTimestamp()
      });
    }
  }

  function patchDmSocket(socket) {
    if (!socket || socket.__mingrx312DmPatched) return false;
    if (typeof socket.watchDm !== 'function' || typeof socket.sendDm !== 'function') return false;
    socket.__mingrx312DmPatched = true;

    const watchDmBase = socket.watchDm.bind(socket);
    socket.watchDm = async function watchDmMingrx312(peerId) {
      await ensureFriendThread(this, peerId);
      return watchDmBase(peerId);
    };

    const sendDmBase = socket.sendDm.bind(socket);
    socket.sendDm = async function sendDmMingrx312(payload = {}) {
      await ensureFriendThread(this, payload.userId);
      return sendDmBase(payload);
    };
    return true;
  }

  if (typeof renderDmSidebar === 'function' && !renderDmSidebar.__mingrx312Wrapped) {
    const renderDmSidebarBase = renderDmSidebar;
    renderDmSidebar = function renderDmSidebarMingrx312(...args) {
      const result = renderDmSidebarBase.apply(this, args);
      decoratePrivateSidebar();
      queueMicrotask(decoratePrivateSidebar);
      return result;
    };
    renderDmSidebar.__mingrx312Wrapped = true;
  }

  if (typeof bindSocket === 'function' && !bindSocket.__mingrx312Wrapped) {
    const bindSocketBase = bindSocket;
    bindSocket = function bindSocketMingrx312(socket) {
      const result = bindSocketBase(socket);
      patchDmSocket(socket);
      return result;
    };
    bindSocket.__mingrx312Wrapped = true;
  }

  patchDmSocket(state.socket);
  queueMicrotask(decoratePrivateSidebar);

  window.Mingrx312 = Object.freeze({
    decoratePrivateSidebar,
    patchDmSocket,
    ensureFriendThread,
    orderedConversations,
    hideRecent,
    readHiddenRecents,
    hiddenRecentsKey: HIDDEN_RECENTS_KEY
  });
})();
