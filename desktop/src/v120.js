/* Banana Cord v1.2.1 — links públicos, deep links e estabilidade do modal de convite. */
(() => {
  const { ipcRenderer } = require('electron');
  const VERSION = '1.2.1';
  const PUBLIC_INVITE_BASE = 'https://rafaelmingroni.github.io/banana-cord/?invite=';
  const INVITE_LEAD = 'Compartilhe o código ou um link. O Banana Cord encontra o host automaticamente.';
  const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  const normalizeShort = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const looksShort = value => {
    const raw = normalizeShort(value);
    return [8, 12].includes(raw.length) && [...raw].every(ch => CODE_ALPHABET.includes(ch));
  };
  const formatShort = value => {
    const raw = normalizeShort(value);
    return raw.length === 12 ? `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8)}` :
      raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4)}` : raw;
  };
  const publicInviteLink = code => `${PUBLIC_INVITE_BASE}${encodeURIComponent(formatShort(code))}`;

  async function copyText(text, message = 'Copiado.') {
    await ipcRenderer.invoke('clipboard:write', String(text || ''));
    if (typeof toast === 'function') toast(message);
  }

  async function resolveAndJoin(rawCode) {
    const code = formatShort(rawCode);
    if (!looksShort(code)) return;
    const setupInput = document.getElementById('setupInvite');
    const nameInput = document.getElementById('setupName');
    if (setupInput) setupInput.value = code;
    const savedName = nameInput?.value.trim() || state?.user?.name || localStorage.getItem('banana.name') || '';
    if (!savedName.trim()) {
      document.getElementById('setup')?.classList.remove('hidden');
      document.getElementById('app')?.classList.add('hidden');
      nameInput?.focus();
      if (typeof toast === 'function') toast('Convite carregado. Digite seu nome para entrar.', 4800);
      return;
    }
    if (nameInput && !nameInput.value.trim()) nameInput.value = savedName.trim();
    try {
      const result = await ipcRenderer.invoke('invite:resolve-short', code);
      if (!result?.ok) {
        const msg = result?.reason === 'offline'
          ? 'Esse servidor está offline no momento.'
          : result?.reason === 'network'
            ? 'Não consegui consultar o convite. Confira sua internet.'
            : 'Esse convite é inválido ou expirou.';
        if (typeof toast === 'function') toast(msg, 5000);
        return;
      }
      try {
        const cache = JSON.parse(localStorage.getItem('banana.shortCodes') || '{}');
        cache[result.serverId] = result.code;
        localStorage.setItem('banana.shortCodes', JSON.stringify(cache));
      } catch {}
      if (typeof connectTo === 'function') connectTo(result.url, savedName.trim(), result.joinCode);
    } catch (e) {
      if (typeof toast === 'function') toast(e?.message || 'Não consegui abrir esse convite.', 5000);
    }
  }

  ipcRenderer.on('invite:deep-link', (_event, payload) => {
    const code = payload?.code || payload;
    resolveAndJoin(code);
  });

  function enhancePermanentInvite(root) {
    const card = root.querySelector('.premium-code-card');
    const codeNode = card?.querySelector('strong');
    const copyCode = card?.querySelector('#copyShortInvite');
    if (!card || !codeNode || !copyCode || card.dataset.linkReady === '1') return;
    const code = formatShort(codeNode.textContent);
    if (!looksShort(code)) return;

    // Marque antes de alterar o DOM: o MutationObserver verá as mudanças,
    // mas não repetirá esta transformação.
    card.dataset.linkReady = '1';
    const link = publicInviteLink(code);
    const preview = document.createElement('div');
    preview.className = 'invite-link-preview';
    preview.innerHTML = `<span>Link do servidor</span><code>${link}</code>`;
    const row = document.createElement('div');
    row.className = 'premium-copy-row';
    const linkButton = document.createElement('button');
    linkButton.className = 'secondary';
    linkButton.textContent = 'Copiar link';
    linkButton.addEventListener('click', () => copyText(link, 'Link do servidor copiado.'));
    copyCode.parentNode.insertBefore(preview, copyCode);
    copyCode.parentNode.insertBefore(row, copyCode);
    row.append(copyCode, linkButton);
  }

  function enhanceTemporaryInvite(root) {
    const result = root.querySelector('.temporary-result:not(.hidden)');
    const codeNode = result?.querySelector('strong');
    if (!result || !codeNode || result.dataset.linkReady === '1') return;
    const code = formatShort(codeNode.textContent);
    if (!looksShort(code)) return;
    result.dataset.linkReady = '1';
    const linkButton = document.createElement('button');
    linkButton.className = 'secondary temporary-link-button';
    linkButton.textContent = 'Copiar link temporário';
    linkButton.addEventListener('click', () => copyText(publicInviteLink(code), 'Link temporário copiado.'));
    result.insertAdjacentElement('afterend', linkButton);
  }

  function enhanceInviteModal() {
    const root = document.querySelector('#modalBody .premium-invite');
    if (!root) return;
    const lead = root.querySelector('.premium-invite-head p');

    // IMPORTANTE: alterar textContent incondicionalmente dentro de um
    // MutationObserver cria uma nova mutação e pode travar o renderer.
    if (lead && lead.textContent !== INVITE_LEAD) lead.textContent = INVITE_LEAD;

    enhancePermanentInvite(root);
    enhanceTemporaryInvite(root);
  }

  const modalBody = document.getElementById('modalBody');
  if (modalBody) {
    let enhancementQueued = false;
    const scheduleEnhancement = () => {
      if (enhancementQueued) return;
      enhancementQueued = true;
      queueMicrotask(() => {
        enhancementQueued = false;
        try { enhanceInviteModal(); }
        catch (error) { console.error('Banana Cord invite enhancement:', error); }
      });
    };
    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(modalBody, { childList: true, subtree: true });
  }

  document.querySelectorAll('.setup .brand p b, .settings-nav-foot').forEach(el => {
    if (el.textContent !== `v${VERSION}`) el.textContent = `v${VERSION}`;
  });
})();
