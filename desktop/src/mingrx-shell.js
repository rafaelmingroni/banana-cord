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

  function openCommunityModal() {
    if (typeof window.openModal !== 'function' && typeof openModal !== 'function') return;
    const show = typeof window.openModal === 'function' ? window.openModal : openModal;
    show(`
      <div class="simple-modal-head mingrx-community-head">
        <h2>Comunidades</h2>
        <p>Crie seu espaço no Mingrx ou entre usando um código de convite.</p>
      </div>
      <label>Nome da nova comunidade</label>
      <input id="newServerName" maxlength="40" autocomplete="off" placeholder="Minha comunidade">
      <button id="createServerNow">Criar comunidade</button>
      <div class="divider"><span>ou</span></div>
      <label>Código de convite</label>
      <input id="joinCode" maxlength="32" autocomplete="off" placeholder="A1B2C3D4">
      <button id="joinServerNow" class="secondary">Entrar na comunidade</button>
    `);
    queueMicrotask(() => document.getElementById('newServerName')?.focus());
  }

  function installCommunityTrigger() {
    if (window.__mingrxCommunityTriggerInstalled) return;
    window.__mingrxCommunityTriggerInstalled = true;
    document.addEventListener('click', event => {
      const trigger = event.target?.closest?.('#addServerBtn,#v207StartServer');
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openCommunityModal();
    }, true);
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
    buildTopBar();
    buildMemberToggle();
    normalizeLabels();
  }

  patchNotifications();
  installCommunityTrigger();
  refresh();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE && /Banana (Cord|Cloud)/.test(node.nodeValue || '')) replaceText(node.parentNode || document.body);
        if (node.nodeType === Node.ELEMENT_NODE) {
          replaceText(node);
          replaceImages(node);
          replaceLegacyMarks(node);
        }
      }
    }
    buildMemberToggle();
  });
  observer.observe(document.body, { childList:true, subtree:true });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('mingrx-members-open')) {
      document.body.classList.remove('mingrx-members-open');
      document.querySelector('.mingrx-members-toggle')?.classList.remove('active');
    }
  });
})();
