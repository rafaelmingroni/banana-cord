/* Banana Cord V2 auth UI hardening.
 * Keeps Entrar/Criar conta navigation functional even if cloud initialization fails.
 */
(() => {
  const byId = id => document.getElementById(id);

  function setVisible(el, visible) {
    if (!el) return;
    el.classList.toggle('hidden', !visible);
    el.hidden = !visible;
    el.style.setProperty('display', visible ? 'grid' : 'none', 'important');
  }

  function selectCloudTab(tab) {
    const login = byId('cloudLoginForm');
    const register = byId('cloudRegisterForm');
    if (!login || !register) return;

    const isRegister = tab === 'register';
    setVisible(login, !isRegister);
    setVisible(register, isRegister);

    document.querySelectorAll('[data-cloud-tab]').forEach(button => {
      const active = button.dataset.cloudTab === (isRegister ? 'register' : 'login');
      button.type = 'button';
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const error = byId('cloudAuthError');
    if (error) {
      error.textContent = '';
      error.classList.add('hidden');
    }
  }

  // Capture phase intentionally makes the tab switch independent from cloud-v2.js.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-cloud-tab]');
    if (!button) return;
    event.preventDefault();
    selectCloudTab(button.dataset.cloudTab);
  }, true);

  // Normalize initial state after all cloud scripts have been parsed.
  queueMicrotask(() => {
    document.querySelectorAll('[data-cloud-tab]').forEach(button => { button.type = 'button'; });
    const active = document.querySelector('[data-cloud-tab].active')?.dataset.cloudTab || 'login';
    selectCloudTab(active);
  });

  window.BananaCloudUI = { selectTab: selectCloudTab };
})();
