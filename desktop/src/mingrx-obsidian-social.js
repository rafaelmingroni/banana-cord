/* Mingrx Obsidian — Social Hub microinteractions and icon polish. */
(() => {
  if (window.__mingrxObsidianSocialLoaded) return;
  window.__mingrxObsidianSocialLoaded = true;

  const MESSAGE_ICON = '<span class="mx-button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg></span>';

  function socialUsers() {
    try {
      const social = state?.v1?.social || {};
      return ['friends','incoming','outgoing','blocked']
        .flatMap(key => Array.isArray(social[key]) ? social[key] : []);
    } catch { return []; }
  }

  function peerById(id) {
    if (!id) return null;
    try {
      return state?.members?.get?.(id)
        || socialUsers().find(user => user?.id === id)
        || state?.dmConversations?.find?.(row => row?.user?.id === id)?.user
        || null;
    } catch { return socialUsers().find(user => user?.id === id) || null; }
  }

  function statusClass(user) {
    const status = String(user?.status || '').toLowerCase();
    if (['online','available'].includes(status)) return 'online';
    if (['away','idle'].includes(status)) return 'away';
    if (['busy','dnd'].includes(status)) return 'busy';
    return 'offline';
  }

  function decorateAvatar(avatar) {
    if (!avatar || avatar.parentElement?.classList?.contains('mingrx-social-avatar-wrap')) return;
    const id = avatar.dataset.socialAvatar || '';
    if (!id) return;
    const wrap = document.createElement('span');
    wrap.className = 'mingrx-social-avatar-wrap';
    avatar.before(wrap);
    wrap.appendChild(avatar);
    const status = document.createElement('i');
    status.className = `mingrx-social-status ${statusClass(peerById(id))}`;
    status.setAttribute('aria-hidden', 'true');
    wrap.appendChild(status);
  }

  function decorateHub(root = document) {
    const hub = root?.matches?.('.mingrx-social-hub') ? root : root?.querySelector?.('.mingrx-social-hub');
    if (!hub) return;

    const head = hub.querySelector('.mingrx-social-head');
    const description = head?.querySelector('p');
    if (description && description.dataset.mxObsidian !== 'true') {
      description.dataset.mxObsidian = 'true';
      description.textContent = 'Seus amigos, pedidos e conversas diretas.';
    }

    for (const avatar of hub.querySelectorAll('[data-social-avatar]')) decorateAvatar(avatar);

    for (const dm of hub.querySelectorAll('[data-mx-dm]')) {
      if (dm.dataset.mxObsidian === 'true') continue;
      dm.dataset.mxObsidian = 'true';
      dm.innerHTML = MESSAGE_ICON;
      dm.title = 'Mensagem';
      dm.setAttribute('aria-label', 'Abrir mensagem');
    }

    const query = hub.querySelector('#mingrxFriendQuery');
    if (query) {
      query.placeholder = 'Busque pelo nome de usuário';
      query.setAttribute('aria-label', 'Nome do usuário');
    }

    const addCopy = hub.querySelector('.mingrx-add-friend-copy p');
    if (addCopy && addCopy.dataset.mxObsidian !== 'true') {
      addCopy.dataset.mxObsidian = 'true';
      addCopy.textContent = 'Digite o nome da pessoa para enviar uma solicitação de amizade.';
    }
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      decorateHub(document);
    });
  }

  const observer = new MutationObserver(queue);
  observer.observe(document.getElementById('modalBody') || document.body, { childList:true, subtree:true });

  window.addEventListener('mingrx:theme-change', queue);
  queue();
})();
