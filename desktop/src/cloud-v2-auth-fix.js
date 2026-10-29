/* Banana Cord v2 Cloud auth registration guard.
 * Firestore rules require verified e-mail. This intercepts registration so
 * verification is sent before any Firestore profile write occurs and keeps a
 * visible verification state even if Firebase auth changes state mid-flow.
 */
(() => {
  const form = document.getElementById('cloudRegisterForm');
  if (!form) return;

  const showVerificationState = email => {
    const gate = document.getElementById('cloudGate');
    const authPanel = document.getElementById('cloudAuth');
    const verifyPanel = document.getElementById('cloudVerify');
    const loadingPanel = document.getElementById('cloudLoading');
    const emailEl = document.getElementById('cloudVerifyEmail');
    gate?.classList.remove('hidden');
    authPanel?.classList.add('hidden');
    loadingPanel?.classList.add('hidden');
    verifyPanel?.classList.remove('hidden');
    if (emailEl) emailEl.textContent = String(email || '');
  };

  const setVerifyError = message => {
    let el = document.getElementById('cloudVerifyError');
    const panel = document.getElementById('cloudVerify');
    if (!el && panel) {
      el = document.createElement('div');
      el.id = 'cloudVerifyError';
      el.className = 'cloud-error hidden';
      panel.appendChild(el);
    }
    if (!el) return;
    el.textContent = String(message || '');
    el.classList.toggle('hidden', !message);
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    e.stopImmediatePropagation();

    const cloud = window.BananaCloud;
    const auth = cloud?.auth;
    const errorEl = document.getElementById('cloudAuthError');
    const setError = message => {
      if (!errorEl) return;
      errorEl.textContent = String(message || '');
      errorEl.classList.toggle('hidden', !message);
    };

    if (!auth) return setError('Banana Cloud ainda não está configurado.');

    const name = document.getElementById('cloudRegisterName')?.value.trim() || '';
    const email = document.getElementById('cloudRegisterEmail')?.value.trim() || '';
    const password = document.getElementById('cloudRegisterPassword')?.value || '';
    if (!name || !email || password.length < 6) return setError('Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.');

    let createdUser = null;
    try {
      setError('');
      setVerifyError('');
      window.BananaCloudRegistrationInProgress = true;
      const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = require('firebase/auth');
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = credential.user;

      // Auth state changes immediately after account creation. Force the gate into
      // a known visible state before any subsequent async operation can fail.
      showVerificationState(createdUser.email || email);

      await updateProfile(createdUser, { displayName: name });
      await sendEmailVerification(createdUser);
      showVerificationState(createdUser.email || email);
      // Profile is persisted by cloud-v2.js only after emailVerified becomes true.
    } catch (err) {
      const code = String(err?.code || '');
      const map = {
        'auth/email-already-in-use': 'Esse e-mail já possui uma conta.',
        'auth/weak-password': 'Use uma senha mais forte.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
        'auth/network-request-failed': 'Sem conexão com a internet.'
      };
      const message = map[code] || err?.message || 'Não foi possível criar a conta.';

      if (createdUser || auth.currentUser) {
        const user = createdUser || auth.currentUser;
        showVerificationState(user?.email || email);
        setVerifyError(`A conta foi criada, mas houve um problema ao concluir o cadastro: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      window.BananaCloudRegistrationInProgress = false;
    }
  }, true);
})();
