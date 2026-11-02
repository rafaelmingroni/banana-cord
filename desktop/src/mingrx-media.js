/* Mingrx media layer — compressed community icons + Firebase Storage chat images. */
(() => {
  if (window.__mingrxMediaLoaded) return;
  window.__mingrxMediaLoaded = true;

  const PREFIX = '[[MINGRX_IMAGE_V1:';
  const SUFFIX = ']]';
  const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
  const CHAT_MAX_OUTPUT = 1400 * 1024;
  const ICON_MAX_OUTPUT = 360 * 1024;
  let mediaBusy = false;
  let lastServerMenuId = '';

  function b64urlEncode(value) { return Buffer.from(String(value), 'utf8').toString('base64url'); }
  function b64urlDecode(value) { return Buffer.from(String(value), 'base64url').toString('utf8'); }
  function safeHttps(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.toString() : '';
    } catch { return ''; }
  }
  function encodeMedia(meta = {}) {
    const clean = {
      u: safeHttps(meta.url),
      n: String(meta.name || 'imagem').slice(0, 96),
      c: String(meta.caption || '').slice(0, 500)
    };
    if (!clean.u) throw new Error('URL de mídia inválida.');
    const marker = `${PREFIX}${b64urlEncode(JSON.stringify(clean))}${SUFFIX}`;
    if (marker.length > 1900) throw new Error('A legenda da imagem ficou grande demais.');
    return marker;
  }
  function parseMedia(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith(PREFIX) || !raw.endsWith(SUFFIX)) return null;
    try {
      const data = JSON.parse(b64urlDecode(raw.slice(PREFIX.length, -SUFFIX.length)));
      const url = safeHttps(data?.u);
      if (!url) return null;
      return {
        url,
        name: String(data?.n || 'imagem').slice(0, 96),
        caption: String(data?.c || '').slice(0, 500)
      };
    } catch { return null; }
  }

  async function bitmapFor(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler esta imagem.')); };
      image.src = url;
    });
  }
  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não consegui compactar a imagem.')), type, quality);
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não consegui preparar a foto da comunidade.'));
      reader.readAsDataURL(blob);
    });
  }

  async function compressImage(file, {
    maxDimension = 1920,
    maxBytes = CHAT_MAX_OUTPUT,
    minDimension = 320
  } = {}) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      throw new Error('Escolha uma imagem PNG, JPG, JPEG ou WebP.');
    }
    if (Number(file.size || 0) > MAX_SOURCE_BYTES) {
      throw new Error('A imagem original deve ter no máximo 40 MB.');
    }

    const source = await bitmapFor(file);
    const sourceWidth = Number(source.width || source.naturalWidth || 0);
    const sourceHeight = Number(source.height || source.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) {
      source.close?.();
      throw new Error('Imagem inválida.');
    }

    const initialScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * initialScale));
    let height = Math.max(1, Math.round(sourceHeight * initialScale));
    let smallest = null;

    try {
      for (let pass = 0; pass < 8; pass += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) throw new Error('Não consegui preparar o compressor de imagens.');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, width, height);

        for (const quality of [0.88, 0.80, 0.72, 0.64, 0.56, 0.48, 0.40]) {
          const blob = await canvasBlob(canvas, 'image/webp', quality).catch(() => null);
          if (!blob) continue;
          if (!smallest || blob.size < smallest.size) smallest = blob;
          if (blob.size <= maxBytes) return { blob, width, height };
        }

        if (Math.max(width, height) <= minDimension) break;
        width = Math.max(1, Math.round(width * 0.78));
        height = Math.max(1, Math.round(height * 0.78));
      }

      if (smallest && smallest.size <= maxBytes) return { blob: smallest, width, height };
      throw new Error('Não consegui reduzir esta imagem o suficiente. Tente outro arquivo.');
    } finally {
      source.close?.();
    }
  }

  async function uploadBlob(blob, path) {
    const uploader = window.MingrxCloudStorage?.uploadImage || window.BananaCloud?.uploadImage;
    if (typeof uploader !== 'function') {
      throw new Error('Mingrx Cloud Storage ainda não está pronto. Tente novamente em alguns segundos.');
    }
    return uploader(path, blob, {
      contentType: blob.type || 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable'
    });
  }
  function objectId() { return crypto.randomUUID().replace(/-/g, ''); }
  function cleanPath(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96) || 'unknown'; }
  function mediaError(error, fallback = 'Não consegui enviar a imagem.') {
    const code = String(error?.code || '');
    const message = String(error?.message || fallback);
    if (code.includes('storage/unauthorized') || code.includes('storage/unauthenticated')) {
      return 'O Firebase Storage bloqueou o envio. Publique as regras de Storage do Mingrx no Firebase.';
    }
    if (code.includes('storage/')) return `Falha no armazenamento de imagens do Mingrx: ${message}`;
    return message;
  }

  function setAttachBusy(busy) {
    mediaBusy = !!busy;
    const button = document.getElementById('mingrxAttachBtn');
    if (!button) return;
    button.disabled = mediaBusy;
    button.classList.toggle('mingrx-media-busy', mediaBusy);
    button.textContent = mediaBusy ? '…' : '＋';
    button.title = mediaBusy ? 'Enviando imagem…' : 'Anexar imagem';
  }

  async function sendImageFile(file) {
    if (mediaBusy || !file) return;
    const isDm = state.viewMode === 'dm' && !!state.activeDmUserId;
    const isChannel = state.viewMode === 'server' && !!state.selectedServer && state.selectedChannel?.type === 'text';
    if (!isDm && !isChannel) return toast('Abra uma conversa de texto para anexar uma imagem.', 3200);

    setAttachBusy(true);
    try {
      const { blob } = await compressImage(file, {
        maxDimension: 1920,
        maxBytes: CHAT_MAX_OUTPUT,
        minDimension: 480
      });
      const uid = cleanPath(window.BananaCloud?.user?.uid || state.user?.id);
      const scope = isDm
        ? `dm-${cleanPath([state.user?.id, state.activeDmUserId].sort().join('_'))}`
        : `community-${cleanPath(state.selectedServer.id)}-${cleanPath(state.selectedChannel.id)}`;
      const url = await uploadBlob(blob, `mingrx/chat-media/${uid}/${scope}/${objectId()}.webp`);
      const caption = String(els.messageInput?.value || '').trim().slice(0, 500);
      const marker = encodeMedia({ url, name: file.name || 'imagem', caption });
      if (isDm) state.socket.emit('dm:send', { userId: state.activeDmUserId, text: marker });
      else state.socket.emit('message:send', { serverId: state.selectedServer.id, channelId: state.selectedChannel.id, text: marker });
      if (els.messageInput) els.messageInput.value = '';
      toast('Imagem enviada.', 2200);
    } catch (error) {
      toast(mediaError(error), 5600);
    } finally {
      setAttachBusy(false);
    }
  }

  function ensureComposerMediaButton() {
    if (!els?.messageForm || document.getElementById('mingrxAttachBtn')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.id = 'mingrxMediaInput';
    input.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'mingrxAttachBtn';
    button.textContent = '＋';
    button.title = 'Anexar imagem';
    button.setAttribute('aria-label', 'Anexar imagem');
    button.addEventListener('click', () => { if (!mediaBusy) input.click(); });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) await sendImageFile(file);
    });
    els.messageForm.insertBefore(button, els.messageInput);
    els.messageForm.appendChild(input);

    els.messageInput?.addEventListener('paste', event => {
      const item = [...(event.clipboardData?.items || [])].find(row => String(row.type || '').startsWith('image/'));
      const file = item?.getAsFile?.();
      if (!file) return;
      event.preventDefault();
      sendImageFile(file);
    });
  }

  function openLightbox(url, alt) {
    document.querySelector('.mingrx-image-lightbox')?.remove();
    const box = document.createElement('div');
    box.className = 'mingrx-image-lightbox';
    box.tabIndex = -1;
    const image = document.createElement('img');
    image.src = url;
    image.alt = alt || 'Imagem anexada';
    const close = document.createElement('button');
    close.className = 'mingrx-image-lightbox-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar imagem');
    const remove = () => { document.removeEventListener('keydown', onKey, true); box.remove(); };
    const onKey = event => { if (event.key === 'Escape') remove(); };
    box.addEventListener('click', event => { if (event.target === box) remove(); });
    close.onclick = remove;
    box.append(image, close);
    document.body.appendChild(box);
    document.addEventListener('keydown', onKey, true);
    close.focus();
  }

  function decorateMessageRows(messages = []) {
    const container = els?.messages;
    if (!container) return;
    const rows = [...container.querySelectorAll('.message')];
    messages.forEach((message, index) => {
      const media = parseMedia(message?.text);
      if (!media) return;
      let row = null;
      if (message?.id) {
        try { row = container.querySelector(`.message[data-message-id="${CSS.escape(String(message.id))}"]`); }
        catch {}
      }
      row ||= rows[index];
      if (!row || row.dataset.mingrxMedia === String(message.id || index)) return;
      const text = row.querySelector('.msg-text');
      if (!text) return;
      row.dataset.mingrxMedia = String(message.id || index);
      text.textContent = media.caption || '';
      text.classList.toggle('hidden', !media.caption);
      if (media.caption) text.classList.add('mingrx-media-caption');

      const card = document.createElement('div');
      card.className = 'mingrx-chat-image-card';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'mingrx-chat-image-button';
      open.title = 'Abrir imagem';
      const image = document.createElement('img');
      image.src = media.url;
      image.alt = media.name || 'Imagem anexada';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      open.appendChild(image);
      open.onclick = () => openLightbox(media.url, media.name);
      const meta = document.createElement('div');
      meta.className = 'mingrx-chat-image-meta';
      meta.textContent = media.name || 'Imagem';
      card.append(open, meta);
      (text.parentElement || row).appendChild(card);
    });
  }

  try {
    const baseRenderMessages = renderMessages;
    renderMessages = function renderMessagesMingrxMedia(...args) {
      const result = baseRenderMessages.apply(this, args);
      const list = state.selectedChannel ? (state.messagesByChannel.get(state.selectedChannel.id) || []) : [];
      decorateMessageRows(list);
      return result;
    };
  } catch {}
  try {
    const baseRenderDmMessages = renderDmMessages;
    renderDmMessages = function renderDmMessagesMingrxMedia(...args) {
      const result = baseRenderDmMessages.apply(this, args);
      const list = state.activeDmUserId ? (state.dmMessages.get(state.activeDmUserId) || []) : [];
      decorateMessageRows(list);
      return result;
    };
  } catch {}

  function canManageServer(server) {
    if (!server || !state.user?.id) return false;
    const role = typeof roleFor === 'function' ? roleFor(state.user.id, server) : 'member';
    return role === 'owner' || role === 'admin';
  }

  async function updateCommunityPhoto(file, server = state.selectedServer) {
    const target = server;
    if (!target || !canManageServer(target)) throw new Error('Apenas administradores podem alterar a foto da comunidade.');
    const { blob } = await compressImage(file, {
      maxDimension: 512,
      maxBytes: ICON_MAX_OUTPUT,
      minDimension: 128
    });
    const uid = cleanPath(window.BananaCloud?.user?.uid || state.user?.id);
    let icon = '';
    try {
      icon = await uploadBlob(blob, `mingrx/community-icons/${uid}/${cleanPath(target.id)}/${objectId()}.webp`);
    } catch (storageError) {
      // Community icons have a compatibility fallback so an old Firebase Storage
      // deployment cannot block the rebrand launch. Chat media still requires Storage.
      icon = await blobToDataUrl(blob);
      if (icon.length > 760000) throw storageError;
    }
    target.icon = icon;
    if (state.selectedServer?.id === target.id) state.selectedServer.icon = icon;
    renderServers();
    state.socket?.emit?.('server:update', { serverId: target.id, icon });
    return icon;
  }

  function pickCommunityPhoto(server = state.selectedServer) {
    const target = server;
    if (!target) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.hidden = true;
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      toast('Compactando foto da comunidade…', 1800);
      try {
        await updateCommunityPhoto(file, target);
        toast('Foto da comunidade atualizada.', 2600);
      } catch (error) {
        toast(mediaError(error, 'Não consegui atualizar a foto da comunidade.'), 5600);
      }
    };
    input.addEventListener('cancel', () => input.remove(), { once: true });
    input.click();
  }

  function injectCommunityPhotoCard() {
    const server = state.selectedServer;
    const body = els?.modalBody;
    if (!server || !body || !canManageServer(server) || body.querySelector('.mingrx-community-photo-card')) return;
    const settings = body.querySelector('.v219-role-settings') || body.querySelector('.server-settings-grid') || body;
    if (!settings) return;

    const card = document.createElement('div');
    card.className = 'mingrx-community-photo-card';
    const preview = document.createElement('div');
    preview.className = 'mingrx-community-photo-preview';
    const updatePreview = () => {
      preview.style.backgroundImage = server.icon ? `url("${String(server.icon).replace(/"/g, '%22')}")` : '';
      preview.textContent = server.icon ? '' : String(server.name || 'M').trim().slice(0, 2).toUpperCase();
    };
    updatePreview();

    const copy = document.createElement('div');
    copy.className = 'mingrx-community-photo-copy';
    const title = document.createElement('b');
    title.textContent = 'Foto da comunidade';
    const note = document.createElement('small');
    note.textContent = 'Escolha uma foto normal do seu PC. O Mingrx reduz e otimiza automaticamente arquivos de até 40 MB.';
    const actions = document.createElement('div');
    actions.className = 'mingrx-community-photo-actions';
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'primary';
    choose.textContent = server.icon ? 'Trocar foto' : 'Escolher foto';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.classList.toggle('hidden', !server.icon);

    choose.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.hidden = true;
      document.body.appendChild(input);
      input.onchange = async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;
        choose.disabled = true;
        choose.textContent = 'Compactando…';
        try {
          await updateCommunityPhoto(file, server);
          updatePreview();
          remove.classList.remove('hidden');
          choose.textContent = 'Trocar foto';
          toast('Foto da comunidade atualizada.');
        } catch (error) {
          toast(mediaError(error, 'Não consegui atualizar a foto.'), 5600);
          choose.textContent = server.icon ? 'Trocar foto' : 'Escolher foto';
        } finally {
          choose.disabled = false;
        }
      };
      input.addEventListener('cancel', () => input.remove(), { once: true });
      input.click();
    };
    remove.onclick = () => {
      server.icon = '';
      renderServers();
      state.socket?.emit?.('server:update', { serverId: server.id, icon: '' });
      updatePreview();
      remove.classList.add('hidden');
      choose.textContent = 'Escolher foto';
      toast('Foto removida.');
    };

    actions.append(choose, remove);
    copy.append(title, note, actions);
    card.append(preview, copy);
    const hero = settings.querySelector('.v219-role-hero, h2');
    if (hero?.nextSibling) settings.insertBefore(card, hero.nextSibling);
    else settings.prepend(card);
  }

  // The V2.0.19 settings handler stops propagation, so observe the modal itself
  // instead of depending on another click listener.
  if (els?.modalBody) {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (els.modalBody.querySelector('.v219-role-settings,.server-settings-grid')) injectCommunityPhotoCard();
      });
    }).observe(els.modalBody, { childList: true, subtree: true });
  }

  // Replace the legacy context-menu photo path at capture phase. That old path
  // rejected every file above ~550 KB before Mingrx could compress it.
  document.addEventListener('contextmenu', event => {
    const serverButton = event.target?.closest?.('.server-icon[data-server-id]');
    if (serverButton?.dataset.serverId) lastServerMenuId = serverButton.dataset.serverId;
  }, true);
  document.addEventListener('click', event => {
    const item = event.target?.closest?.('.v1-context-menu .v1-menu-item');
    if (!item) return;
    const icon = item.querySelector('span')?.textContent || '';
    if (!icon.includes('🖼')) return;
    const server = state.servers.find(row => row.id === lastServerMenuId) || state.selectedServer;
    if (!server) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    item.closest('.v1-context-menu')?.remove();
    pickCommunityPhoto(server);
  }, true);

  ensureComposerMediaButton();
  window.MingrxMedia = Object.freeze({
    encodeMedia,
    parseMedia,
    compressImage,
    sendImageFile,
    updateCommunityPhoto,
    pickCommunityPhoto,
    injectCommunityPhotoCard
  });
})();
