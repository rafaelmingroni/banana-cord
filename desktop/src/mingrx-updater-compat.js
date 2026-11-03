const { autoUpdater } = require('electron-updater');

const OFFICIAL_UPDATE_OWNER = 'rafaelmingroni';
const OFFICIAL_UPDATE_REPO = 'mingrx-app';
const LEGACY_UPDATE_REPOS = new Set(['banana-cord', 'mingrx']);

if (!autoUpdater.__mingrxFeedCompatPatched) {
  const originalSetFeedURL = autoUpdater.setFeedURL.bind(autoUpdater);
  autoUpdater.setFeedURL = function setMingrxFeedURL(options) {
    if (options && typeof options === 'object' && options.provider === 'github') {
      const owner = String(options.owner || '').toLowerCase();
      const repo = String(options.repo || '').toLowerCase();
      if (owner === OFFICIAL_UPDATE_OWNER && LEGACY_UPDATE_REPOS.has(repo)) {
        options = { ...options, owner: OFFICIAL_UPDATE_OWNER, repo: OFFICIAL_UPDATE_REPO };
      }
    }
    return originalSetFeedURL(options);
  };
  autoUpdater.__mingrxFeedCompatPatched = true;
}

module.exports = {
  OFFICIAL_UPDATE_OWNER,
  OFFICIAL_UPDATE_REPO
};
