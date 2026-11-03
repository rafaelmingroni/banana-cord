/* Mingrx 3.1 — community settings placement + explicit stop-watching control. */
(() => {
  if (window.__mingrx31UxFixesLoaded) return;
  window.__mingrx31UxFixesLoaded = true;

  let watchedCardId = '';

  function repairCommunitySettings() {
    const body = window.els?.modalBody || document.getElementById('modalBody');
    const root = body?.querySelector('.v219-role-settings');
    if (!body || !root) return false;

    const modalCard = root.closest('.modal-card');
    modalCard?.classList.add('mingrx-server-settings-modal');

    try { window.MingrxMedia?.injectCommunityPhotoCard?.(); } catch {}

    const card = body.querySelector('.mingrx-community-photo-card');
    const hero = root.querySelector(':scope > .v219-role-hero');
    if (card && hero && card.parentElement !== root) hero.insertAdjacentElement('afterend', card);
    else if (card && hero && card.previousElementSibling !== hero) hero.insertAdjacentElement('afterend', card);

    if (card) {
      card.dataset.mingrx31Placement = 'fixed';
      const choose = [...card.querySelectorAll('button')].find(button => /foto/i.test(button.textContent || '') && !/remover/i.test(button.textContent || ''));
      if (choose) {
        choose.style.display = 'inline-flex';
        choose.style.visibility = 'visible';
        choose.disabled = false;
      }
    }
    return !!card;
  }

  function scheduleCommunityRepair() {
    for (const delay of [0, 60, 160, 320]) setTimeout(repairCommunitySettings, delay);
  }

  document.getElementById('serverSettingsBtn')?.addEventListener('click', scheduleCommunityRepair, true);

  const modalBody = document.getElementById('modalBody');
  if (modalBody) {
    new MutationObserver(() => {
      if (modalBody.querySelector('.v219-role-settings')) scheduleCommunityRepair();
    }).observe(modalBody, { childList:true, subtree:true });
  }

  function stopWatching({ silent = false } = {}) {
    const card = watchedCardId ? document.getElementById(watchedCardId) : document.querySelector('.video-card.mingrx-watching-stream');
    card?.classList.remove('mingrx-watching-stream');
    card?.querySelector('.mingrx-stop-watching')?.remove();
    watchedCardId = '';

    try {
      if (typeof state !== 'undefined') {
        state.ui.focusSharing = false;
        state.ui.showAllOverride = true;
      }
      if (typeof applyFocusSharing === 'function') applyFocusSharing();
    } catch {}

    if (!silent && typeof toast === 'function') toast('Você parou de assistir à transmissão.', 2200);
  }

  function markWatchingCard(card) {
    if (!card || card.id === 'video-local') return false;
    if (watchedCardId && watchedCardId !== card.id) stopWatching({ silent:true });
    watchedCardId = card.id;
    card.classList.add('mingrx-watching-stream');

    let button = card.querySelector('.mingrx-stop-watching');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'mingrx-stop-watching';
      button.textContent = '✕ Parar de assistir';
      button.title = 'Parar de assistir à transmissão';
      button.setAttribute('aria-label', 'Parar de assistir à transmissão');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        stopWatching();
      });
      card.appendChild(button);
    }
    return true;
  }

  function detectWatchTarget() {
    const target = document.querySelector('.video-card.v207-watch-target')
      || [...document.querySelectorAll('.video-card.is-sharing')].find(card => card.id !== 'video-local');
    if (!target) return false;
    return markWatchingCard(target);
  }

  function scheduleWatchDetection() {
    for (const delay of [280, 520, 1000, 1500]) setTimeout(detectWatchTarget, delay);
  }

  // v207 stops click bubbling itself, so capture the intent before the legacy handler runs.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('.v207-watch-stream,#v207ProfileWatch')) scheduleWatchDetection();
  }, true);

  const baseWatchBroadcast = window.BananaWatchBroadcast;
  if (typeof baseWatchBroadcast === 'function' && !baseWatchBroadcast.__mingrx31Wrapped) {
    const wrapped = async function mingrx31WatchBroadcast(...args) {
      const result = await baseWatchBroadcast.apply(this, args);
      scheduleWatchDetection();
      return result;
    };
    wrapped.__mingrx31Wrapped = true;
    window.BananaWatchBroadcast = wrapped;
  }

  const videoGrid = document.getElementById('videoGrid');
  if (videoGrid) {
    new MutationObserver(() => {
      if (!watchedCardId) return;
      const card = document.getElementById(watchedCardId);
      if (!card || !card.classList.contains('is-sharing')) stopWatching({ silent:true });
    }).observe(videoGrid, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  window.Mingrx31UX = Object.freeze({
    repairCommunitySettings,
    markWatchingCard,
    stopWatching,
    get watchedCardId() { return watchedCardId; }
  });
})();
