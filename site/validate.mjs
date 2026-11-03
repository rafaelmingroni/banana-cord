import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'index.html','app.js','editorial-v3.css','invite.html','privacy.html','terms.html','support.html','CNAME','robots.txt','sitemap.xml'
].map(async name => [name, await readFile(new URL(`./${name}`, import.meta.url), 'utf8')])));

const checks = [
  ['custom domain', files['CNAME'].trim() === 'mingrx.site'],
  ['homepage title', files['index.html'].includes('Mingrx — Converse, jogue e compartilhe')],
  ['editorial stylesheet', files['index.html'].includes('editorial-v3.css') && files['editorial-v3.css'].includes('--violet')],
  ['dynamic download links', files['index.html'].includes('download-link') && files['app.js'].includes('/releases/latest')],
  ['invite compatibility', files['app.js'].includes("params.get('invite')") && files['invite.html'].includes('mingrx://join/')],
  ['mobile viewport', files['index.html'].includes('width=device-width,initial-scale=1')],
  ['skip link', files['index.html'].includes('class="skip-link"') && files['index.html'].includes('id="conteudo"')],
  ['keyboard focus', files['editorial-v3.css'].includes(':focus-visible')],
  ['reduced motion', files['editorial-v3.css'].includes('prefers-reduced-motion') && files['app.js'].includes('prefers-reduced-motion')],
  ['semantic navigation', files['index.html'].includes('aria-label="Navegação principal"') && files['index.html'].includes('aria-label="Links do rodapé"')],
  ['privacy page', files['privacy.html'].includes('Política de Privacidade')],
  ['terms page', files['terms.html'].includes('Termos de Uso')],
  ['support page', files['support.html'].includes('<h1>Suporte</h1>')],
  ['robots sitemap', files['robots.txt'].includes('https://mingrx.site/sitemap.xml')],
  ['sitemap home', files['sitemap.xml'].includes('<loc>https://mingrx.site/</loc>')]
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (failed.length) {
  console.error(`Site validation failed: ${failed.map(([label]) => label).join(', ')}`);
  process.exit(1);
}
console.log('Mingrx site validation passed.');
