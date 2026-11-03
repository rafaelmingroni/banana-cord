import { readFile } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'index.html','app.js','editorial-v3.css','real-ui-v4.css','invite.html','privacy.html','terms.html','support.html','CNAME','robots.txt','sitemap.xml'
].map(async name => [name, await readFile(new URL(`./${name}`, import.meta.url), 'utf8')])));

const checks = [
  ['custom domain', files['CNAME'].trim() === 'mingrx.site'],
  ['homepage title', files['index.html'].includes('Mingrx — Entre na call. Chame a galera.')],
  ['editorial stylesheet', files['index.html'].includes('editorial-v3.css') && files['editorial-v3.css'].includes('--violet')],
  ['real ui stylesheet', files['index.html'].includes('real-ui-v4.css') && files['real-ui-v4.css'].includes('.real-workspace')],
  ['real private layout', files['index.html'].includes('class="real-private"') && files['index.html'].includes('Seu espaço privado') && files['index.html'].includes('Adicionar amigo')],
  ['Portuguese positioning', files['index.html'].includes('ENTRE NA') && files['index.html'].includes('CHAME A GALERA.') && files['index.html'].includes('O QUE SUA GALERA USA')],
  ['no bilingual campaign copy', !files['index.html'].includes('NO DISTRACTIONS.') && !files['index.html'].includes('PRIVATE MEANS PRIVATE') && !files['index.html'].includes('YOUR CREW') && !files['app.js'].includes('MORNING ·')],
  ['no fake performance claims', !files['index.html'].includes('--w:92%') && !files['index.html'].includes('BAIXO OVERHEAD') && !files['index.html'].includes('LOW NOISE') && !files['index.html'].includes('id="desempenho"')],
  ['clear E2EE home copy', files['index.html'].includes('Mensagens privadas trocadas entre clientes compatíveis usam criptografia ponta a ponta') && files['index.html'].includes('o conteúdo é criptografado de ponta a ponta no dispositivo')],
  ['no legacy caveat in marketing', !files['index.html'].includes('Mensagens antigas podem ter sido criadas antes desse recurso') && !files['index.html'].includes('Mensagens antigas ou criadas por versões anteriores')],
  ['precise E2EE privacy copy', files['privacy.html'].includes('Novas mensagens privadas entre clientes compatíveis') && files['privacy.html'].includes('Mensagens antigas ou criadas por versões anteriores')],
  ['fictional public examples', !files['index.html'].includes('Gustavo') && !files['index.html'].includes('Ari')],
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
