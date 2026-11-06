/* Final Mingrx UI behavior fixes. Keeps layout work in CSS and adds only drawer accessibility. */
(() => {
  if (window.__mingrxFinalFixesLoaded) return;
  window.__mingrxFinalFixesLoaded = true;

  const drawer = document.querySelector('.members');
  const toggle = document.querySelector('.mingrx-members-toggle');
  if (!drawer) return;

  const closeMembers = ({ restoreFocus = false } = {}) => {
    const wasOpen = document.body.classList.contains('mingrx-members-open');
    window.MingrxSetMembersVisible?.(false);
    document.body.classList.remove('mingrx-members-open');
    toggle?.classList.remove('active');
    toggle?.setAttribute('aria-pressed', 'false');
    toggle?.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    if (restoreFocus && wasOpen) toggle?.focus();
  };

  let head = drawer.querySelector('.mingrx-members-head');
  if (!head) {
    head = document.createElement('div');
    head.className = 'mingrx-members-head';
    const existingTitle = drawer.querySelector(':scope > h3');
    const title = existingTitle || document.createElement('h3');
    title.textContent = 'Membros';
    title.id = title.id || 'mingrxMembersTitle';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'mingrx-members-close';
    close.setAttribute('aria-label', 'Fechar membros');
    close.title = 'Fechar membros';
    close.textContent = '×';
    head.append(title, close);
    drawer.prepend(head);
    close.addEventListener('click', () => closeMembers({ restoreFocus:true }));
  }

  drawer.setAttribute('role', 'complementary');
  drawer.setAttribute('aria-labelledby', 'mingrxMembersTitle');
  drawer.setAttribute('aria-hidden', document.body.classList.contains('mingrx-members-open') ? 'false' : 'true');
  if (toggle) {
    toggle.setAttribute('aria-controls', 'memberList');
    toggle.setAttribute('aria-expanded', document.body.classList.contains('mingrx-members-open') ? 'true' : 'false');
    toggle.addEventListener('click', () => {
      requestAnimationFrame(() => {
        const open = document.body.classList.contains('mingrx-members-open');
        toggle.setAttribute('aria-expanded', String(open));
        drawer.setAttribute('aria-hidden', String(!open));
        if (open && window.innerWidth < 980) drawer.querySelector('.mingrx-members-close')?.focus();
      });
    });
  }

  function syncMembersVisibility() {
    const open = document.body.classList.contains('mingrx-members-open')
      && !document.getElementById('app')?.classList.contains('dm-mode');
    drawer.setAttribute('aria-hidden', String(!open));
    drawer.inert = !open;
    toggle?.setAttribute('aria-expanded', String(open));
  }
  window.addEventListener('mingrx:members-change', syncMembersVisibility);
  const app = document.getElementById('app');
  if (app) new MutationObserver(syncMembersVisibility).observe(app, { attributes:true, attributeFilter:['class'] });
  syncMembersVisibility();

  document.addEventListener('pointerdown', event => {
    if (window.innerWidth >= 980) return;
    if (!document.body.classList.contains('mingrx-members-open')) return;
    if (drawer.contains(event.target) || toggle?.contains(event.target)) return;
    closeMembers();
  });

  window.addEventListener('keydown', event => {
    if (window.innerWidth < 980 && event.key === 'Escape' && document.body.classList.contains('mingrx-members-open')) {
      closeMembers({ restoreFocus:true });
    }
  });

  window.MingrxCloseMembers = closeMembers;
})();
