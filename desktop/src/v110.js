/* Banana Cord v1.1.1/V2 — convites curtos, com suporte Banana Cloud. */
(() => {
  const { ipcRenderer } = require('electron');
  const VERSION = '1.1.1';
  const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const isCloud = () => !!window.BananaCloudMode && !!window.BananaCloudSocket?.connected;

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

  function setSetupBusy(busy, label = '') {
    const button = document.getElementById('connectBtn');
    const host = document.getElementById('hostBtn');
    if (button) { button.disabled = !!busy; button.textContent = busy ? (label || 'Conectando…') : 'Entrar no Banana Cord'; }
    if (host) host.disabled = !!busy;
  }

  async function connectShortCode(raw) {
    if (isCloud()) {
      state.socket.emit('server:join', { inviteCode: formatShort(raw) });
      return;
    }
    const name = document.getElementById('setupName')?.value.trim();
    if (!name) return toast('Digite seu nome primeiro.');
    setSetupBusy(true, 'Procurando servidor…');
    try {
      const result = await ipcRenderer.invoke('invite:resolve-short', raw);
      if (!result?.ok) {
        const msg = result?.reason === 'offline' ? 'Esse servidor parece estar offline no momento.' : result?.reason === 'network' ? 'Não consegui consultar o convite agora. Confira sua internet e tente novamente.' : 'Código de convite inválido ou expirado.';
        toast(msg, 4800); return;
      }
      try { const cache = JSON.parse(localStorage.getItem('banana.shortCodes') || '{}'); cache[result.serverId] = result.code; localStorage.setItem('banana.shortCodes', JSON.stringify(cache)); } catch {}
      connectTo(result.url, name, result.joinCode);
    } catch (e) { toast(e?.message || 'Não consegui localizar esse servidor.', 4800); }
    finally { if (!state?.socket?.connected) setSetupBusy(false); }
  }

  const input = document.getElementById('setupInvite');
  const connectButton = document.getElementById('connectBtn');
  connectButton?.addEventListener('click', e => {
    const raw = input?.value.trim() || ''; if (!looksShort(raw)) return;
    e.preventDefault(); e.stopImmediatePropagation(); connectShortCode(raw);
  }, true);
  input?.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !looksShort(input.value)) return;
    e.preventDefault(); e.stopImmediatePropagation(); connectShortCode(input.value);
  }, true);

  async function cachedShortCode(serverId) {
    try { const cache = JSON.parse(localStorage.getItem('banana.shortCodes') || '{}'); return cache[serverId] || ''; }
    catch { return ''; }
  }
  async function serverShortCode(serverId) {
    if (isCloud()) return state.servers.find(s => s.id === serverId)?.inviteCode || state.selectedServer?.inviteCode || '';
    try { const local = await ipcRenderer.invoke('invite:code-for-server', serverId); if (local?.ok && local.code) return local.code; } catch {}
    return cachedShortCode(serverId);
  }
  async function copyText(text, message = 'Copiado.') { await ipcRenderer.invoke('clipboard:write', String(text || '')); toast(message); }

  async function createTempCloud(serverId, minutes) {
    return new Promise(resolve => state.socket.emit('invite:create-temporary', { serverId, minutes }, result => resolve(result || { ok: false })));
  }

  async function openPremiumInviteModal() {
    const s = state.selectedServer; if (!s) return;
    const cloud = isCloud();
    const url = state.isHost ? (state.publicHostUrl || state.serverUrl) : state.serverUrl;
    const legacy = cloud ? '' : makeInvite(url, s.inviteCode);
    const short = await serverShortCode(s.id);
    const localInfo = cloud ? { ok: true } : await ipcRenderer.invoke('invite:code-for-server', s.id).catch(() => null);
    const canTemporary = !!localInfo?.ok;

    openModal(`
      <div class="premium-invite">
        <div class="premium-invite-head">
          <span class="premium-kicker">CONVIDAR AMIGOS</span>
          <h2>${escapeHtml(s.name)}</h2>
          <p>${cloud ? 'Compartilhe o código ou o link. O servidor fica disponível no Banana Cloud.' : 'Compartilhe só o código. O Banana Cord encontra o host automaticamente.'}</p>
        </div>
        ${short ? `
          <div class="premium-code-card">
            <span>Código fixo do servidor</span>
            <strong>${escapeHtml(formatShort(short))}</strong>
            <small>${cloud ? 'Fica salvo na nuvem e não depende do computador do dono estar ligado.' : 'Continua o mesmo mesmo quando o endereço do host muda.'}</small>
            <button id="copyShortInvite" class="action">Copiar código</button>
          </div>` : '<div class="premium-invite-warning">Este servidor ainda não possui um código de convite.</div>'}
        ${canTemporary ? `
          <div class="temporary-invite-card">
            <div><b>Convite temporário</b><small>Crie um código que expira automaticamente.</small></div>
            <div class="temporary-invite-row">
              <select id="temporaryInviteDuration">
                <option value="30">30 minutos</option><option value="60" selected>1 hora</option><option value="1440">24 horas</option><option value="10080">7 dias</option>
              </select>
              <button id="createTemporaryInvite" class="secondary">Gerar código</button>
            </div>
            <div id="temporaryInviteResult" class="temporary-result hidden"></div>
          </div>` : ''}
        ${cloud ? '' : `<details class="legacy-invite"><summary>Compatibilidade / convite completo</summary><div class="invite-box">${escapeHtml(legacy)}</div><button id="copyLegacyInvite" class="secondary">Copiar convite completo</button></details>`}
        <p class="premium-invite-note">${cloud ? 'Mensagens e servidores ficam sincronizados na nuvem. Voz, câmera e tela continuam usando WebRTC para manter o Banana Cord leve.' : 'O host precisa estar com o Banana Cord em execução. Se estiver offline, o código volta a funcionar quando o host abrir o app.'}</p>
      </div>`);

    document.getElementById('copyShortInvite')?.addEventListener('click', () => copyText(formatShort(short), 'Código do servidor copiado.'));
    document.getElementById('copyLegacyInvite')?.addEventListener('click', () => copyText(legacy, 'Convite completo copiado.'));
    document.getElementById('createTemporaryInvite')?.addEventListener('click', async () => {
      const button = document.getElementById('createTemporaryInvite'), resultBox = document.getElementById('temporaryInviteResult');
      button.disabled = true; button.textContent = 'Gerando…';
      try {
        const minutes = Number(document.getElementById('temporaryInviteDuration')?.value || 60);
        const result = cloud ? await createTempCloud(s.id, minutes) : await ipcRenderer.invoke('invite:create-temporary', { serverId: s.id, minutes });
        if (!result?.ok) throw new Error(result?.message || 'Não consegui criar o convite.');
        const expires = new Date(result.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        resultBox.classList.remove('hidden');
        resultBox.innerHTML = `<strong>${escapeHtml(formatShort(result.code))}</strong><small>Expira em ${escapeHtml(expires)}</small><button id="copyTemporaryInvite" class="secondary">Copiar</button>`;
        document.getElementById('copyTemporaryInvite')?.addEventListener('click', () => copyText(formatShort(result.code), 'Convite temporário copiado.'));
      } catch (e) { toast(e?.message || 'Não consegui criar o convite temporário.', 4200); }
      finally { button.disabled = false; button.textContent = 'Gerar código'; }
    });
  }

  const inviteButton = document.getElementById('inviteBtn');
  inviteButton?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openPremiumInviteModal(); }, true);

  try {
    copyInviteFor = async function copyInviteForV110(s) {
      const code = await serverShortCode(s.id);
      if (code) return copyText(formatShort(code), 'Código do servidor copiado.');
      if (isCloud()) return toast('Este servidor ainda não possui convite.');
      const url = state.isHost ? (state.publicHostUrl || state.serverUrl) : state.serverUrl;
      return copyText(makeInvite(url, s.inviteCode), 'Convite completo copiado.');
    };
  } catch {}

  const versionTargets = document.querySelectorAll('.setup .brand p b, .settings-nav-foot');
  versionTargets.forEach(el => { el.textContent = window.BananaCloudMode ? 'v2 Cloud Preview' : `v${VERSION}`; });
})();
