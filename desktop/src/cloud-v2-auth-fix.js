/* Banana Cord v2 Cloud auth registration guard.
 * Firestore rules require verified e-mail. This intercepts registration so
 * verification is sent before any Firestore profile write occurs.
 */
(() => {
  const form = document.getElementById('cloudRegisterForm');
  if (!form) return;

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

    try {
      setError('');
      const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = require('firebase/auth');
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);
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
      setError(map[code] || err?.message || 'Não foi possível criar a conta.');
    }
  }, true);
})();
