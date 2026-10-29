const { app, session, desktopCapturer } = require('electron');

// Screen-share compatibility layer for Windows notebooks.
// Electron's native/system picker path is still experimental on supported
// platforms. Banana Cord targets Windows, so prefer an explicit desktop source
// and always choose a real screen before any window source.
app.whenReady().then(() => {
  const ses = session.defaultSession;
  if (!ses?.setDisplayMediaRequestHandler) return;

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });

      const screenSources = sources.filter(source => String(source?.id || '').startsWith('screen:'));
      const video = screenSources[0] || sources[0] || null;
      if (!video) return callback(null);

      const streams = { video };
      if (request?.audioRequested && process.platform === 'win32') streams.audio = 'loopback';
      callback(streams);
    } catch (error) {
      console.warn('Banana Cord screen capture handler:', error?.message || error);
      callback(null);
    }
  }, { useSystemPicker: false });
});
