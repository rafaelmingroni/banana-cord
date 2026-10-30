const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const outdir = path.join(root, 'src', 'cloud-browser');
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

(async () => {
  await esbuild.build({
    stdin: {
      contents: [
        "require('./cloud-v2.js');",
        "require('./cloud-v2-auth-fix.js');",
        "require('./cloud-v2-ui-fix.js');",
        "require('./cloud-v2-socket.js');",
        "require('./cloud-v2-server-delete-fix.js');",
        "require('./cloud-v2-social-fix.js');",
        "require('./cloud-v2-v212.js');",
        "require('./cloud-v2-v212-incoming-status.js');",
        "require('./cloud-v2-webrtc-fix.js');"
      ].join('\n'),
      resolveDir: path.join(root, 'src'),
      sourcefile: 'cloud-v2-browser-entry.js'
    },
    outfile: path.join(outdir, 'cloud-v2-all.browser.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['chrome140'],
    minify: false,
    sourcemap: false,
    logLevel: 'warning',
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });
  console.log('Banana Cloud single browser bundle generated.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
