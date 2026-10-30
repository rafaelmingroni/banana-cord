/* Banana Cord V2.0.17 — premium in-app updater */
(() => {
  const { ipcRenderer } = require('electron');
  const badge = document.getElementById('updateBadge');
  if (!badge) return;

  const shell = document.createElement('div');
  shell.id = 'bananaUpdater';
  shell.className = 'banana-updater hidden';
  shell.innerHTML = `
    <div class="banana-updater-card" role="status" aria-live="polite">
      <div class="banana-updater-head">
        <div class="banana-updater-logo"><img src="../assets/banana-cord.png" alt=""></div>
        <div class="banana-updater-title-wrap">
          <span class="banana-updater-kicker">BANANA CORD UPDATE</span>
          <strong id="bananaUpdaterTitle">Atualizando Banana Cord</strong>
          <small id="bananaUpdaterSubtitle">Preparando...</small>
        </div>
        <button id="bananaUpdaterClose" class="banana-updater-close" type="button" title="Minimizar">×</button>
      </div>
      <div id="bananaUpdaterProgressWrap" class="banana-updater-progress-wrap">
        <div class="banana-updater-progress-track"><div id="bananaUpdaterProgress" class="banana-updater-progress"></div></div>
        <div class="banana-updater-progress-meta"><span id="bananaUpdaterPercent">0%</span><span id="bananaUpdaterSpeed"></span></div>
      </div>
      <div id="bananaUpdaterActions" class="banana-updater-actions hidden">
        <button id="bananaUpdaterInstall" class="banana-updater-primary" type="button">Atualizar agora</button>
        <button id="bananaUpdaterLater" class="banana-updater-secondary" type="button">Depois</button>
      </div>
      <div id="bananaUpdaterRetryWrap" class="banana-updater-actions hidden">
        <button id="bananaUpdaterRetry" class="banana-updater-secondary" type="button">Tentar novamente</button>
      </div>
    </div>
  `;
  document.body.appendChild(shell);

  const overlay = document.createElement('div');
  overlay.id = 'bananaUpdaterOverlay';
  overlay.className = 'banana-updater-overlay hidden';
  overlay.innerHTML = `
    <div class="banana-updater-installing">
      <div class="banana-updater-install-logo"><img src="../assets/banana-cord.png" alt="Banana Cord"></div>
      <span class="banana-updater-kicker">BANANA CORD</span>
      <h2>Aplicando atualização...</h2>
      <p>Estamos fechando sua sessão com segurança. O Banana Cord vai abrir novamente já atualizado.</p>
      <div class="banana-updater-install-line"><span></span></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const title = document.getElementById('bananaUpdaterTitle');
  const subtitle = document.getElementById('bananaUpdaterSubtitle');
  const progressWrap = document.getElementById('bananaUpdaterProgressWrap');
  const progress = document.getElementById('bananaUpdaterProgress');
  const percent = document.getElementById('bananaUpdaterPercent');
  const speed = document.getElementById('bananaUpdaterSpeed');
  const actions = document.getElementById('bananaUpdaterActions');
  const retryWrap = document.getElementById('bananaUpdaterRetryWrap');
  const installBtn = document.getElementById('bananaUpdaterInstall');
  const laterBtn = document.getElementById('bananaUpdaterLater');
  const retryBtn = document.getElementById('bananaUpdaterRetry');
  const closeBtn = document.getElementById('bananaUpdaterClose');

  let currentState = { phase: 'idle', version: '', percent: 0 };
  let downloadNoticeShown = false;
  let autoHideTimer = null;

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${Math.round(bytes)} B`;
  }

  function showCard() {
    shell.classList.remove('hidden');
  }

  function hideCard() {
    shell.classList.add('hidden');
  }

  function setBadge(text, ready = false) {
    badge.textContent = text;
    badge.classList.remove('hidden');
    badge.classList.toggle('ready', ready);
  }

  function clearAutoHide() {
    if (autoHideTimer) clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  function scheduleDownloadMinimize() {
    clearAutoHide();
    autoHideTimer = setTimeout(() => {
      if (currentState.phase === 'downloading') hideCard();
    }, 5200);
  }

  function render(rawState = {}) {
    currentState = { ...currentState, ...rawState };
    const phase = currentState.phase || 'idle';
    const version = currentState.version || '';
    const pct = Math.max(0, Math.min(100, Math.round(Number(currentState.percent || 0))));

    overlay.classList.toggle('hidden', phase !== 'installing');
    retryWrap.classList.add('hidden');
    actions.classList.add('hidden');
    progressWrap.classList.remove('hidden');
    closeBtn.classList.remove('hidden');
    badge.classList.remove('ready');

    if (phase === 'idle') {
      clearAutoHide();
      hideCard();
      badge.classList.add('hidden');
      return;
    }

    if (phase === 'checking') {
      title.textContent = 'Verificando atualização';
      subtitle.textContent = 'Procurando a versão mais recente...';
      progress.style.width = '18%';
      percent.textContent = '';
      speed.textContent = '';
      setBadge('↻ Verificando...');
      showCard();
      return;
    }

    if (phase === 'downloading') {
      title.textContent = version ? `Baixando Banana Cord ${version}` : 'Baixando atualização';
      const transferred = formatBytes(currentState.transferred);
      const total = formatBytes(currentState.total);
      subtitle.textContent = transferred && total ? `${transferred} de ${total} · você pode continuar usando normalmente` : 'Baixando em segundo plano · você pode continuar usando normalmente';
      progress.style.width = `${pct}%`;
      percent.textContent = `${pct}%`;
      const rate = formatBytes(currentState.bytesPerSecond);
      speed.textContent = rate ? `${rate}/s` : '';
      setBadge(`↓ ${pct}%`);
      if (!downloadNoticeShown) {
        downloadNoticeShown = true;
        showCard();
        scheduleDownloadMinimize();
      }
      return;
    }

    if (phase === 'ready') {
      clearAutoHide();
      title.textContent = version ? `Banana Cord ${version} está pronto` : 'Atualização pronta';
      subtitle.textContent = 'Reinicie quando quiser. A aplicação será feita silenciosamente.';
      progress.style.width = '100%';
      percent.textContent = '100%';
      speed.textContent = 'Pronto para reiniciar';
      actions.classList.remove('hidden');
      setBadge('✓ Atualização pronta', true);
      showCard();
      return;
    }

    if (phase === 'installing') {
      clearAutoHide();
      hideCard();
      badge.classList.add('hidden');
      return;
    }

    if (phase === 'error') {
      clearAutoHide();
      title.textContent = 'Atualização pausada';
      subtitle.textContent = 'Não foi possível concluir agora. Você pode continuar usando o Banana Cord normalmente.';
      progressWrap.classList.add('hidden');
      retryWrap.classList.remove('hidden');
      setBadge('! Atualização');
      showCard();
    }
  }

  badge.addEventListener('click', () => {
    if (shell.classList.contains('hidden')) showCard();
    else hideCard();
  });

  closeBtn.addEventListener('click', hideCard);
  laterBtn.addEventListener('click', hideCard);
  installBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    installBtn.disabled = true;
    setTimeout(() => ipcRenderer.send('banana-updater:install'), 220);
  });
  retryBtn.addEventListener('click', () => ipcRenderer.invoke('banana-updater:check').catch(() => {}));

  ipcRenderer.on('banana-updater:state', (_event, state) => render(state));
  ipcRenderer.invoke('banana-updater:get-state').then(render).catch(() => {});

  ipcRenderer.invoke('banana-updater:get-version').then(currentVersion => {
    const previousVersion = localStorage.getItem('banana.lastVersion') || '';
    localStorage.setItem('banana.lastVersion', String(currentVersion || ''));
    if (!previousVersion || !currentVersion || previousVersion === currentVersion) return;
    setTimeout(() => {
      if (currentState.phase !== 'idle') return;
      title.textContent = `Atualizado para ${currentVersion} ✓`;
      subtitle.textContent = 'Banana Cord atualizado com sucesso.';
      progressWrap.classList.add('hidden');
      actions.classList.add('hidden');
      retryWrap.classList.add('hidden');
      closeBtn.classList.remove('hidden');
      showCard();
      setTimeout(() => {
        if (currentState.phase === 'idle') hideCard();
      }, 6500);
    }, 1100);
  }).catch(() => {});
})();
