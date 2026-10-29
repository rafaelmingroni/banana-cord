const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const outdir = path.join(root, 'src', 'cloud-browser');
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const builds = [
  ['cloud-v2.js', 'cloud-v2.browser.js'],
  ['cloud-v2-auth-fix.js', 'cloud-v2-auth-fix.browser.js'],
  ['cloud-v2-socket.js', 'cloud-v2-socket.browser.js']
];

(async () => {
  for (const [entry, outfile] of builds) {
    await esbuild.build({
      entryPoints: [path.join(root, 'src', entry)],
      outfile: path.join(outdir, outfile),
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
  }
  console.log('Banana Cloud browser bundles generated.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
