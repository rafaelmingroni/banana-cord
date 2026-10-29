/* Banana Cord V2 official release fixes.
 * Handles button-bound notification sounds and hardens the post-login boot.
 * Firebase rules require request.auth.token.email_verified === true. Right
 * after a user verifies the e-mail, Firebase Auth may expose user.emailVerified
 * before the cached ID token has refreshed. Without this guard the first
 * Firestore request can fail with "missing or insufficient permissions" and
 * leave both the auth gate and the app shell hidden.
 */
(() => {
  if (window.__bananaV2ReleaseFixes) return;
  window.__bananaV2ReleaseFixes = true;

  const enabled = name => {
    const master = localStorage.getItem('banana.soundMaster');
    const specific = localStorage.getItem(`banana.${name}`);
    return master !== 'false' && specific !== 'false';
  };

  function bindStateSound(button, key, pref, onKind, offKind) {
    if (!button || button.dataset.releaseSoundBound === '1') return;
    button.dataset.releaseSoundBound = '1';
    button.addEventListener('click', () => {
      const wasConnected = !!state?.voice?.channelId;
      const before = !!state?.voice?.[key];
      setTimeout(() => {
        const after = !!state?.voice?.[key];
        if (!wasConnected || before === after || !enabled(pref)) return;
        window.BananaNotificationSounds?.play?.(after ? onKind : offKind);
      }, 0);
    }, true);
  }

  bindStateSound(document.getElementById('muteBtn'), 'muted', 'soundMute', 'mute', 'unmute');
  bindStateSound(document.getElementById('deafenBtn'), 'deafened', 'soundDeafen', 'deafen', 'undeafen');

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const gate = () => document.getElementById('cloudGate');
  const authPanel = () => document.getElementById('cloudAuth');
  const verifyPanel = () => document.getElementById('cloudVerify');
  const loadingPanel = () => document.getElementById('cloudLoading');
  const appShell = () => document.getElementById('app');

  function ensureBootRecoveryUi() {
    const loading = loadingPanel();
    if (!loading) return null;

    let error = document.getElementById('cloudBootError');
    if (!error) {
      error = document.createElement('div');
      error.id = 'cloudBootError';
      error.className = 'cloud-error hidden';
      loading.appendChild(error);
    }

    let actions = document.getElementById('cloudBootActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'cloudBootActions';
      actions.className = 'cloud-actions hidden';
      actions.innerHTML = '<button id="cloudBootRetry" class="primary" type="button">Tentar novamente</button><button id="cloudBootLogout" type="button">Usar outra conta</button>';
      loading.appendChild(actions);

      document.getElementById('cloudBootRetry')?.addEventListener('click', () => {
        const user = window.BananaCloud?.auth?.currentUser;
        if (user) recoverVerifiedBoot(user, { source: 'retry' });
      });
      document.getElementById('cloudBootLogout')?.addEventListener('click', () => window.BananaCloud?.signOut?.());
    }

    return { loading, error, actions };
  }

  function showBootLoading(message = 'Finalizando login no Banana Cord…') {
    const ui = ensureBootRecoveryUi();
    gate()?.classList.remove('hidden');
    authPanel()?.classList.add('hidden');
    verifyPanel()?.classList.add('hidden');
    loadingPanel()?.classList.remove('hidden');
    const spinner = loadingPanel()?.querySelector('.cloud-spinner');
    if (spinner) spinner.classList.remove('hidden');
    const text = loadingPanel()?.querySelector('p');
    if (text) text.textContent = message;
    if (ui) {
      ui.error.textContent = '';
      ui.error.classList.add('hidden');
      ui.actions.classList.add('hidden');
    }
  }

  function showVerificationState(user) {
    window.BananaCloud.ready = false;
    gate()?.classList.remove('hidden');
    authPanel()?.classList.add('hidden');
    loadingPanel()?.classList.add('hidden');
    verifyPanel()?.classList.remove('hidden');
    const email = document.getElementById('cloudVerifyEmail');
    if (email) email.textContent = user?.email || '';
    const verifyError = document.getElementById('cloudVerifyError');
    if (verifyError) {
      verifyError.textContent = 'A verificação ainda não chegou à sessão. Clique no link do e-mail e depois em “Já verifiquei”.';
      verifyError.classList.remove('hidden');
    }
  }

  function friendlyBootError(error) {
    const code = String(error?.code || '');
    const raw = String(error?.message || '');
    if (code.includes('permission-denied') || /missing or insufficient permissions/i.test(raw)) {
      return 'O Firebase ainda não reconheceu a verificação desta sessão. Atualizei o token; clique em “Tentar novamente”.';
    }
    if (code.includes('network') || code.includes('unavailable')) {
      return 'Não foi possível concluir o login por causa da conexão com o Banana Cloud. Confira a internet e tente novamente.';
    }
    return raw || 'Não foi possível concluir o login no Banana Cord.';
  }

  function showBootError(error) {
    const ui = ensureBootRecoveryUi();
    gate()?.classList.remove('hidden');
    authPanel()?.classList.add('hidden');
    verifyPanel()?.classList.add('hidden');
    loadingPanel()?.classList.remove('hidden');
    const spinner = loadingPanel()?.querySelector('.cloud-spinner');
    if (spinner) spinner.classList.add('hidden');
    const text = loadingPanel()?.querySelector('p');
    if (text) text.textContent = 'Não foi possível concluir o login.';
    if (ui) {
      ui.error.textContent = friendlyBootError(error);
      ui.error.classList.remove('hidden');
      ui.actions.classList.remove('hidden');
    }
  }

  async function waitForAppShell(timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const app = appShell();
      if (app && !app.classList.contains('hidden')) return true;
      await sleep(120);
    }
    return false;
  }

  let recoveryRunning = false;
  async function recoverVerifiedBoot(user, detail = {}) {
    if (!user || recoveryRunning) return;
    recoveryRunning = true;
    showBootLoading();

    try {
      await user.reload();
      if (!user.emailVerified) {
        showVerificationState(user);
        return;
      }

      // Critical: refresh the ID token so Firestore/RTDB rules see
      // request.auth.token.email_verified === true immediately.
      const token = await user.getIdTokenResult(true);
      if (token?.claims?.email_verified !== true) {
        const stale = new Error('A sessão autenticada ainda não recebeu a confirmação do e-mail.');
        stale.code = 'auth/email-verification-token-stale';
        throw stale;
      }

      window.BananaCloud.ready = true;

      // The Cloud socket listener ignores duplicate boots while one is active.
      // A second attempt is useful if the first request failed while the old
      // token was still in flight.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        window.dispatchEvent(new CustomEvent('banana:cloud-ready', {
          detail: {
            ...detail,
            uid: user.uid,
            user,
            __tokenRefreshed: true,
            __bootAttempt: attempt + 1
          }
        }));

        if (await waitForAppShell()) {
          loadingPanel()?.classList.add('hidden');
          gate()?.classList.add('hidden');
          return;
        }
        await sleep(450);
      }

      throw new Error('O Banana Cloud não terminou de carregar a interface.');
    } catch (error) {
      window.BananaCloud.ready = false;
      console.error('Banana Cloud verified-session recovery:', error);
      showBootError(error);
    } finally {
      recoveryRunning = false;
    }
  }

  // Capture phase deliberately runs before the Cloud socket's normal listener.
  // We stop the first event, refresh the verified token, then replay the event.
  window.addEventListener('banana:cloud-ready', event => {
    if (event.detail?.__tokenRefreshed) return;
    event.stopImmediatePropagation();
    const user = event.detail?.user || window.BananaCloud?.auth?.currentUser;
    if (!user) return showBootError(new Error('Sessão autenticada não encontrada.'));
    recoverVerifiedBoot(user, event.detail || {});
  }, true);

  // Absolute fallback: a verified/ready session must never leave every visible
  // surface hidden. If that state happens, show recovery instead of black.
  setInterval(() => {
    const cloud = window.BananaCloud;
    const user = cloud?.auth?.currentUser;
    const appHidden = appShell()?.classList.contains('hidden') !== false;
    const gateHidden = gate()?.classList.contains('hidden') === true;
    if (cloud?.ready && user?.emailVerified && appHidden && gateHidden && !recoveryRunning) {
      showBootError(new Error('A interface não terminou de carregar.'));
    }
  }, 1200);

  // Covers very fast persisted-session startup where Cloud may become ready
  // before this compatibility layer finishes loading.
  queueMicrotask(() => {
    const cloud = window.BananaCloud;
    const user = cloud?.auth?.currentUser;
    if (cloud?.ready && user?.emailVerified && appShell()?.classList.contains('hidden')) {
      recoverVerifiedBoot(user, { source: 'startup-recovery' });
    }
  });
})();
