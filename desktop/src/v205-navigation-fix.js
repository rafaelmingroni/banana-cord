/* Banana Cord V2.0.5 navigation fix. */
(() => {
  if (window.__bananaV205NavigationFix) return;
  window.__bananaV205NavigationFix = true;

  if (typeof selectServer !== 'function') return;

  selectServer = function selectServerV205(id) {
    const s = state.servers.find(x => x.id === id);
    if (!s) return;
    state.viewMode = 'server';
    state.activeDmUserId = null;
    els.app.classList.remove('dm-mode');
    state.selectedServer = s;
    els.serverName.textContent = s.name;
    els.inviteBtn.style.visibility = 'visible';
    els.serverSettingsBtn.style.visibility = 'visible';
    state.voicePresence = new Map();
    renderServers();
    renderChannels();
    state.socket.emit('members:get', { serverId: s.id });
    const firstText = s.channels.find(c => c.type === 'text');
    if (firstText) selectChannel(firstText.id);
    else {
      els.emptyView.classList.remove('hidden');
      els.textView.classList.add('hidden');
      els.voiceView.classList.add('hidden');
    }
  };
})();
