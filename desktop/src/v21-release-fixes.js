/* Banana Cord 2.1 — final integration guards. */
(() => {
  if (window.__bananaV21ReleaseFixes) return;
  window.__bananaV21ReleaseFixes = true;

  // V2.0.14 fixed an important Private-mode regression: global voice/media
  // updates can call renderChannels while the user is in DMs. V2.1 replaces
  // the server channel renderer, so preserve that guard at the final layer.
  const renderChannelsBase = renderChannels;
  renderChannels = function renderChannelsV21PrivateGuard(...args) {
    if (state.viewMode === 'dm') {
      renderDmSidebar();
      return;
    }
    return renderChannelsBase(...args);
  };
})();
