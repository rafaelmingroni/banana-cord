/* Mingrx invite fix — replace all legacy invite listeners with one non-blocking flow. */
(() => {
  if (window.__mingrxInviteFixLoaded) return;
  window.__mingrxInviteFixLoaded = true;
  const { ipcRenderer } = window.MingrxDesktop;

  const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatCode = value => {
    const raw = cleanCode(value);
    return raw.length === 12 ? `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8)}` : raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4)}` : raw;
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const copy = async (text, label='Copiado.') => {
    await ipcRenderer.invoke('clipboard:write', String(text || ''));
    toast(label);
  };
  function emitWithAck(event, payload, timeoutMs = 6500) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('O Mingrx não recebeu resposta a tempo. Tente novamente.'));
      }, timeoutMs);
      try {
        state.socket?.emit(event, payload, result => {
          if (done) return;
          done = true; clearTimeout(timer);
          if (result?.ok === false) reject(new Error(result.message || 'Não foi possível concluir a ação.'));
          else resolve(result || { ok:true });
        });
      } catch (error) {
        if (done) return;
        done = true; clearTimeout(timer); reject(error);
      }
    });
  }

  function openMingrxInvite() {
    const s = state.selectedServer;
    if (!s) return;
    const code = formatCode(s.inviteCode || '');
    const link = code ? `mingrx://join/${cleanCode(code)}` : '';
    const admin = typeof can === 'function' ? can('admin') : false;

    // Open immediately. No network/database await is allowed before the modal is visible.
    openModal(`
      <div class="mingrx-invite">
        <div class="mingrx-invite-head">
          <span class="mingrx-invite-kicker">CONVIDAR AMIGOS</span>
          <h2>${escape(s.name || 'Comunidade')}</h2>
          <p>Compartilhe o código ou o link do Mingrx. Quem receber pode entrar diretamente nesta comunidade.</p>
        </div>
        ${code ? `<div class="mingrx-invite-code"><span>Código da comunidade</span><strong>${escape(code)}</strong><div class="mingrx-invite-actions"><button id="mxInviteCopyCode" class="primary">Copiar código</button><button id="mxInviteCopyLink">Copiar link</button></div></div>` : '<div class="premium-invite-warning">Esta comunidade ainda não possui um código de convite.</div>'}
        ${link ? `<div class="mingrx-invite-link-card"><code>${escape(link)}</code><button id="mxInviteCopyLinkCard" class="mingrx-invite-copy-link">Copiar</button></div>` : ''}
        ${admin ? `<div class="mingrx-temp-card"><div><b>Convite temporário</b><small>Gere um código com expiração sem bloquear a interface.</small></div><div class="mingrx-temp-row"><select id="mxInviteDuration"><option value="30">30 minutos</option><option value="60" selected>1 hora</option><option value="1440">24 horas</option><option value="10080">7 dias</option></select><button id="mxInviteTemporary">Gerar código</button></div><div id="mxInviteTempResult" class="mingrx-temp-result hidden"></div></div>` : ''}
        <p class="mingrx-invite-note">O modal permanece utilizável mesmo se a conexão estiver lenta. Voz e compartilhamento de tela continuam independentes do convite.</p>
      </div>`);

    document.getElementById('mxInviteCopyCode')?.addEventListener('click', () => copy(code, 'Código da comunidade copiado.'));
    document.getElementById('mxInviteCopyLink')?.addEventListener('click', () => copy(link, 'Link de convite copiado.'));
    document.getElementById('mxInviteCopyLinkCard')?.addEventListener('click', () => copy(link, 'Link de convite copiado.'));
    document.getElementById('mxInviteTemporary')?.addEventListener('click', async () => {
      const button = document.getElementById('mxInviteTemporary');
      const box = document.getElementById('mxInviteTempResult');
      if (!button || !box) return;
      button.disabled = true; button.textContent = 'Gerando…';
      try {
        const minutes = Number(document.getElementById('mxInviteDuration')?.value || 60);
        const result = await emitWithAck('invite:create-temporary', { serverId:s.id, minutes }, 6500);
        const temp = formatCode(result.code || '');
        if (!temp) throw new Error('O servidor não retornou um código válido.');
        const expires = result.expiresAt ? new Date(result.expiresAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '';
        box.classList.remove('hidden');
        box.innerHTML = `<strong>${escape(temp)}</strong><small>${expires ? `Expira em ${escape(expires)}` : 'Convite temporário criado.'}</small><button id="mxInviteTempCopy">Copiar</button>`;
        document.getElementById('mxInviteTempCopy')?.addEventListener('click', () => copy(temp, 'Convite temporário copiado.'));
      } catch (error) {
        toast(error?.message || 'Não consegui criar o convite temporário.', 4500);
      } finally {
        button.disabled = false; button.textContent = 'Gerar código';
      }
    });
  }

  function replaceInviteButton() {
    const old = document.getElementById('inviteBtn');
    if (!old || old.dataset.mingrxInvite === '1') return old;
    const fresh = old.cloneNode(true);
    fresh.dataset.mingrxInvite = '1';
    old.replaceWith(fresh);
    try { els.inviteBtn = fresh; } catch {}
    fresh.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      openMingrxInvite();
    });
    return fresh;
  }

  replaceInviteButton();
  window.MingrxInvite = Object.freeze({ open:openMingrxInvite, replaceButton:replaceInviteButton, emitWithAck });
})();
