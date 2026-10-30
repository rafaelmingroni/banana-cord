const { app } = require('electron');
const { patchAutoUpdater } = require('../graceful-shutdown');

let received = null;
const fakeUpdater = {
  quitAndInstall(...args) { received = args; }
};
patchAutoUpdater(fakeUpdater);

const hardTimeout = setTimeout(() => {
  console.error('V2.0.20 updater relaunch E2E failed: hard timeout');
  app.exit(1);
}, 6000);

app.whenReady().then(async () => {
  fakeUpdater.quitAndInstall(true, true);
  await new Promise(resolve => setTimeout(resolve, 500));
  clearTimeout(hardTimeout);
  if (!received || received[0] !== true || received[1] !== true) {
    console.error(`V2.0.20 updater relaunch E2E failed: expected [true,true], got ${JSON.stringify(received)}`);
    return app.exit(1);
  }
  console.log('Banana Cord V2.0.20 updater force-relaunch test: OK');
  console.log(JSON.stringify({ isSilent: received[0], isForceRunAfter: received[1] }));
  app.exit(0);
}).catch(error => {
  clearTimeout(hardTimeout);
  console.error(error?.stack || error?.message || String(error));
  app.exit(1);
});
