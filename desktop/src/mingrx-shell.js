/* Mingrx Preview shell. Keeps the mature communication engine underneath while replacing product identity and navigation shell. */
(() => {
  if (window.__mingrxShellLoaded) return;
  window.__mingrxShellLoaded = true;

  const BRAND = 'Mingrx';
  const MARK = '../assets/mingrx.svg';
  document.title = BRAND;
  document.body.classList.add('mingrx-ui');

  function brandText(value) {
    return String(value ?? '')
      .replace(/Banana Cord/g, BRAND)
      .replace(/BANANA CORD/g, 'MINGRX')
      .replace(/Banana Cloud/g, 'Mingrx Cloud');
  }

  function replaceText(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.nodeValue) continue;
      const next = brandText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }

  function replaceImages(root = document) {
    for (const img of root.querySelectorAll?.('.home-banana-img,.big-banana-img,.banana-updater-logo img,.banana-updater-install-logo img') || []) {
      if (img.getAttribute('src') !== MARK) img.setAttribute('src', MARK);
      img.setAttribute('alt', BRAND);
    }
  }

  function replaceLegacyMarks(root = document) {
    const candidates = [];
    if (root?.matches?.('.big-banana')) candidates.push(root);
    for (const mark of root?.querySelectorAll?.('.big-banana') || []) candidates.push(mark);
    for (const mark of candidates) {
      if (mark.dataset.mingrxMark === 'true') continue;
      mark.dataset.mingrxMark = 'true';
      mark.classList.add('mingrx-empty-mark');
      mark.innerHTML = `<img src="${MARK}" alt="${BRAND}">`;
    }
  }

  function patchNotifications() {
    const NativeNotification = window.Notification;
    if (!NativeNotification || NativeNotification.__mingrxWrapped) return;
    function MingrxNotification(title, options = {}) {
      const safe = { ...options };
      if (safe.body) safe.body = brandText(safe.body);
      return new NativeNotification(brandText(title), safe);
    }
    MingrxNotification.prototype = NativeNotification.prototype;
    Object.setPrototypeOf(MingrxNotification, NativeNotification);
    Object.defineProperty(MingrxNotification, '__mingrxWrapped', { value:true });
    for (const key of ['permission']) {
      try { Object.defineProperty(MingrxNotification, key, { get:() => NativeNotification[key] }); } catch {}
    }
    MingrxNotification.requestPermission = (...args) => NativeNotification.requestPermission(...args);
    window.Notification = MingrxNotification;
  }

  function buildTopBar() {
    const bar = document.querySelector('.servers');
    if (!bar || bar.querySelector('.mingrx-brand')) return;
    const brand = document.createElement('div');
    brand.className = 'mingrx-brand';
    brand.innerHTML = `<img src="${MARK}" alt=""><span>${BRAND}</span>`;
    bar.prepend(brand);

    const spacer = document.createElement('div');
    spacer.className = 'mingrx-top-spacer';
    bar.appendChild(spacer);

    const chip = document.createElement('span');
    chip.className = 'mingrx-preview-chip';
    chip.textContent = 'Preview';
    bar.appendChild(chip);
  }

  function buildMemberToggle() {
    const header = document.querySelector('.main > header');
    if (!header || header.querySelector('.mingrx-members-toggle')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mingrx-members-toggle';
    button.textContent = 'Membros';
    button.title = 'Mostrar ou ocultar membros';
    button.addEventListener('click', () => {
      const open = document.body.classList.toggle('mingrx-members-open');
      button.classList.toggle('active', open);
      button.setAttribute('aria-pressed', String(open));
    });
    header.appendChild(button);
  }

  function buildCommunityModal() {
    let overlay = document.getElementById('mingrxCommunityModal');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'mingrxCommunityModal';
    overlay.className = 'modal hidden mingrx-community-modal';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="modal-card mingrx-community-card" role="dialog" aria-modal="true" aria-labelledby="mingrxCommunityTitle">
        <button type="button" class="modal-close" id="mingrxCommunityClose" aria-label="Fechar">×</button>
        <div class="mingrx-community-head">
          <img src="${MARK}" alt="" aria-hidden="true">
          <div>
            <h2 id="mingrxCommunityTitle">Comunidades</h2>
            <p>Crie seu espaço no Mingrx ou entre usando um convite.</p>
          </div>
        </div>
        <div class="mingrx-community-section">
          <label for="newServerName">Nova comunidade</label>
          <div class="mingrx-community-action-row">
            <input id="newServerName" maxlength="40" autocomplete="off" placeholder="Nome da comunidade">
            <button type="button" id="createServerNow" class="action">Criar</button>
          </div>
        </div>
        <div class="mingrx-community-divider"><span>ou entre em uma existente</span></div>
        <div class="mingrx-community-section">
          <label for="joinCode">Código de convite</label>
          <div class="mingrx-community-action-row">
            <input id="joinCode" maxlength="64" autocomplete="off" placeholder="Cole o código">
            <button type="button" id="joinServerNow" class="secondary">Entrar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
      const name = overlay.querySelector('#newServerName');
      const code = overlay.querySelector('#joinCode');
      if (name) name.value = '';
      if (code) code.value = '';
    };
    const showError = message => {
      if (typeof toast === 'function') toast(message, 3200);
    };
    const emitCreate = () => {
      const name = overlay.querySelector('#newServerName')?.value?.trim() || '';
      if (!name) return showError('Digite um nome para a comunidade.');
      if (typeof state === 'undefined' || !state.socket) return showError('Conecte-se antes de criar uma comunidade.');
      state.socket.emit('server:create', { name });
      close();
    };
    const emitJoin = () => {
      const code = overlay.querySelector('#joinCode')?.value?.trim() || '';
      if (!code) return showError('Cole um código de convite.');
      if (typeof state === 'undefined' || !state.socket) return showError('Conecte-se antes de entrar em uma comunidade.');
      state.socket.emit('server:join', { inviteCode: code });
      close();
    };

    overlay.querySelector('#mingrxCommunityClose')?.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('#createServerNow')?.addEventListener('click', emitCreate);
    overlay.querySelector('#joinServerNow')?.addEventListener('click', emitJoin);
    overlay.querySelector('#newServerName')?.addEventListener('keydown', event => { if (event.key === 'Enter') emitCreate(); });
    overlay.querySelector('#joinCode')?.addEventListener('keydown', event => { if (event.key === 'Enter') emitJoin(); });
    overlay._mingrxClose = close;
    return overlay;
  }

  function openCommunityModal() {
    const overlay = buildCommunityModal();
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.querySelector('#newServerName')?.focus();
  }

  function upgradeCommunityTrigger(target) {
    if (!target || target.dataset.mingrxCommunityTrigger === 'true') return target;
    const clone = target.cloneNode(true);
    clone.dataset.mingrxCommunityTrigger = 'true';
    clone.title = 'Criar ou entrar em uma comunidade';
    target.replaceWith(clone);
    clone.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openCommunityModal();
    });
    return clone;
  }

  function installCommunityTriggers(root = document) {
    if (root?.matches?.('#addServerBtn,#v207StartServer')) upgradeCommunityTrigger(root);
    for (const trigger of root?.querySelectorAll?.('#addServerBtn,#v207StartServer') || []) upgradeCommunityTrigger(trigger);
  }

  function normalizeLabels() {
    const home = document.getElementById('homeServer');
    if (home) home.title = 'Início e mensagens';
    const add = document.getElementById('addServerBtn');
    if (add) add.title = 'Criar ou entrar em uma comunidade';
    const profile = document.getElementById('profileBtn');
    if (profile) profile.title = 'Perfil e configurações';
    const update = document.getElementById('updateBadge');
    if (update) update.title = 'Atualização do Mingrx';
  }

  function refresh(root = document.body) {
    replaceText(root);
    replaceImages(root);
    replaceLegacyMarks(root);
    installCommunityTriggers(root);
    buildTopBar();
    buildMemberToggle();
    normalizeLabels();
  }

  patchNotifications();
  buildCommunityModal();
  refresh();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE && /Banana (Cord|Cloud)/.test(node.nodeValue || '')) replaceText(node.parentNode || document.body);
        if (node.nodeType === Node.ELEMENT_NODE) {
          replaceText(node);
          replaceImages(node);
          replaceLegacyMarks(node);
          installCommunityTriggers(node);
        }
      }
    }
    buildMemberToggle();
  });
  observer.observe(document.body, { childList:true, subtree:true });

  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('mingrx-members-open')) {
      document.body.classList.remove('mingrx-members-open');
      document.querySelector('.mingrx-members-toggle')?.classList.remove('active');
    }
    const community = document.getElementById('mingrxCommunityModal');
    if (community && !community.classList.contains('hidden')) community._mingrxClose?.();
  });
})();
