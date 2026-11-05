/* Mingrx 3.1 Spark media compatibility layer.
 * Chat/DM image uploads are intentionally disabled because Firebase Storage
 * requires billing. Existing 3.0 image markers still render when present.
 * Community photos stay available as compact Firestore data URLs.
 */
(() => {
  if (window.__mingrxMediaLoaded) return;
  window.__mingrxMediaLoaded = true;

  const PREFIX = '[[MINGRX_IMAGE_V1:';
  const SUFFIX = ']]';
  const INPUT_MAX = 12 * 1024 * 1024;
  const COMMUNITY_MAX_OUTPUT = 260 * 1024;

  function b64urlDecode(value) {
    return new TextDecoder().decode(Uint8Array.from(atob(String(value).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
  }

  function safeHttps(value) {
    try {
      const u = new URL(String(value || ''));
      return u.protocol === 'https:' ? u.toString() : '';
    } catch {
      return '';
    }
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
    } catch {
      return null;
    }
  }

  async function bitmapFor(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Não consegui ler esta imagem.'));
      };
      img.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Não consegui compactar a imagem.')),
        type,
        quality
      );
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

  async function compressImage(file, { maxDimension = 512, maxBytes = COMMUNITY_MAX_OUTPUT } = {}) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      throw new Error('Escolha uma imagem PNG, JPG ou WebP.');
    }
    if (file.size > INPUT_MAX) throw new Error('A imagem original deve ter no máximo 12 MB.');

    const source = await bitmapFor(file);
    const sw = Number(source.width || source.naturalWidth || 0);
    const sh = Number(source.height || source.naturalHeight || 0);
    if (!sw || !sh) throw new Error('Imagem inválida.');

    const ratio = Math.min(1, maxDimension / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * ratio));
    const height = Math.max(1, Math.round(sh * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.drawImage(source, 0, 0, width, height);
    source.close?.();

    let blob = null;
    for (const q of [.82, .72, .62, .52, .44]) {
      blob = await canvasBlob(canvas, 'image/webp', q).catch(() => null);
      if (blob && blob.size <= maxBytes) break;
    }
    if (!blob) blob = await canvasBlob(canvas, 'image/jpeg', .62);
    if (blob.size > maxBytes) {
      throw new Error('A imagem ficou grande demais. Tente uma foto menor ou recortada.');
    }
    return { blob, width, height };
  }

  function openLightbox(url, alt) {
    document.querySelector('.mingrx-image-lightbox')?.remove();
    const box = document.createElement('div');
    box.className = 'mingrx-image-lightbox';
    box.tabIndex = -1;
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || 'Imagem anexada';
    const close = document.createElement('button');
    close.className = 'mingrx-image-lightbox-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar imagem');
    const remove = () => {
      document.removeEventListener('keydown', onKey, true);
      box.remove();
    };
    const onKey = event => { if (event.key === 'Escape') remove(); };
    box.addEventListener('click', event => { if (event.target === box) remove(); });
    close.onclick = remove;
    box.append(img, close);
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
        try {
          row = container.querySelector(`.message[data-message-id="${CSS.escape(String(message.id))}"]`);
        } catch {}
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
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mingrx-chat-image-button';
      button.title = 'Abrir imagem';
      const img = document.createElement('img');
      img.src = media.url;
      img.alt = media.name || 'Imagem anexada';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      button.appendChild(img);
      button.onclick = () => openLightbox(media.url, media.name);
      const meta = document.createElement('div');
      meta.className = 'mingrx-chat-image-meta';
      meta.textContent = media.name || 'Imagem';
      card.append(button, meta);
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

  function canEditCommunity(server) {
    if (!server || !state.user?.id) return false;
    const role = typeof roleFor === 'function' ? roleFor(state.user.id, server) : 'member';
    return (ROLE_RANK?.[role] || 0) >= (ROLE_RANK?.admin || 2);
  }

  async function updateCommunityPhoto(file, targetServer = state.selectedServer) {
    const server = targetServer;
    if (!server || !canEditCommunity(server)) {
      throw new Error('Apenas administradores podem alterar a foto da comunidade.');
    }
    const { blob } = await compressImage(file, { maxDimension: 384, maxBytes: COMMUNITY_MAX_OUTPUT });
    const icon = await blobToDataUrl(blob);
    if (!icon || icon.length > 390000) {
      throw new Error('A foto compactada ficou grande demais para o modo gratuito.');
    }
    server.icon = icon;
    const current = state.servers.find(item => item.id === server.id);
    if (current) current.icon = icon;
    renderServers();
    state.socket.emit('server:update', { serverId: server.id, icon });
    return icon;
  }

  function clearCommunityPhoto(targetServer = state.selectedServer) {
    const server = targetServer;
    if (!server || !canEditCommunity(server)) {
      throw new Error('Apenas administradores podem alterar a foto da comunidade.');
    }
    server.icon = '';
    const current = state.servers.find(item => item.id === server.id);
    if (current) current.icon = '';
    renderServers();
    state.socket.emit('server:update', { serverId: server.id, icon: '' });
  }

  function injectCommunityPhotoCard() {
    const server = state.selectedServer;
    const body = els?.modalBody;
    if (!server || !body || !canEditCommunity(server) || body.querySelector('.mingrx-community-photo-card')) return;
    const settings = body.querySelector('.server-settings-grid') || body.querySelector('.v219-server-settings') || body;
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
    note.textContent = 'PNG, JPG ou WebP. A foto é compactada automaticamente e salva no plano gratuito (Spark).';
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.hidden = true;

    choose.onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      choose.disabled = true;
      choose.textContent = 'Salvando…';
      try {
        await updateCommunityPhoto(file, server);
        updatePreview();
        remove.classList.remove('hidden');
        choose.textContent = 'Trocar foto';
        toast('Foto da comunidade atualizada.');
      } catch (error) {
        toast(error?.message || 'Não consegui atualizar a foto.', 5000);
        choose.textContent = server.icon ? 'Trocar foto' : 'Escolher foto';
      } finally {
        choose.disabled = false;
      }
    };

    remove.onclick = () => {
      try {
        clearCommunityPhoto(server);
        updatePreview();
        remove.classList.add('hidden');
        choose.textContent = 'Escolher foto';
        toast('Foto removida.');
      } catch (error) {
        toast(error?.message || 'Não consegui remover a foto.', 4500);
      }
    };

    actions.append(choose, remove, input);
    copy.append(title, note, actions);
    card.append(preview, copy);
    const heading = settings.querySelector('h2');
    if (heading?.nextSibling) settings.insertBefore(card, heading.nextSibling);
    else settings.prepend(card);
  }

  document.getElementById('serverSettingsBtn')?.addEventListener('click', () => {
    queueMicrotask(injectCommunityPhotoCard);
    setTimeout(injectCommunityPhotoCard, 80);
    setTimeout(injectCommunityPhotoCard, 220);
  });

  window.MingrxMedia = Object.freeze({
    parseMedia,
    compressImage,
    updateCommunityPhoto,
    clearCommunityPhoto,
    injectCommunityPhotoCard,
    sparkMode: true,
    chatImageUpload: false
  });
})();
