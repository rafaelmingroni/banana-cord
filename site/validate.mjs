import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('.',import.meta.url));
const names=await readdir(root);
const pages=names.filter(name=>name.endsWith('.html'));
const files=Object.fromEntries(await Promise.all([...pages,'styles.css','legal.css','app.js','invite.js','CNAME','robots.txt','sitemap.xml'].map(async name=>[name,await readFile(path.join(root,name),'utf8')])));
const check=(label,condition)=>{assert(condition,label);console.log(`OK: ${label}`)};
check('custom domain is mingrx.site',files.CNAME.trim()==='mingrx.site');
check('clear product and Windows headline',/Mensagens, chamadas e uma tela para compartilhar/.test(files['index.html'])&&/Aplicativo para Windows/.test(files['index.html']));
check('authentic application capture is explicitly labeled',files['index.html'].includes('Captura real do Mingrx 3.1.10')&&files['index.html'].includes('conta de demonstração')&&(await stat(path.join(root,'assets/mingrx-private.webp'))).size>1000);
check('no invented social proof or online counters',!/testimonial|reviewRating|aggregateRating|data-counter|real-friend|chip-online|voice-rings|disponível agora|sua galera está online/i.test(files['index.html']));
check('no generated people or stock portraits',![...files['index.html'].matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].some(([,src])=>!['./assets/mingrx-mark.svg','./assets/mingrx-private.webp'].includes(src)));
const css=Object.entries(files).filter(([name])=>name.endsWith('.css')).map(([,value])=>value).join('\n');
check('solid surfaces without gradients',!/(?:linear|radial|conic)-gradient\s*\(/i.test(css));
check('no animation or cursor effect',!/@keyframes|\banimation\s*:/.test(css)&&!/pointermove|mousemove|IntersectionObserver|cursor-glow|localStorage|sessionStorage/.test(files['app.js']));
check('rectangular buttons',!/(?:border-radius\s*:\s*(?:999|50%)|border-radius\s*:\s*\d{2,}px)/i.test(css));
check('local fonts and no advertising or analytics code',!Object.values(files).some(value=>/fonts\.googleapis|googletagmanager|google-analytics|facebook\.net|hotjar|clarity\.ms|made with ai|feito com ia/i.test(value)));
check('no typographic dashes in website text',pages.every(name=>!/[\u2013\u2014]/u.test(files[name])));
const iconEmoji=/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u;
check('SVG icons instead of emoji icons',pages.every(name=>!iconEmoji.test(files[name].replace(/<script>[\s\S]*?<\/script>/g,''))));
check('privacy covers actual site and app data flows',/Firebase Authentication/.test(files['privacy.html'])&&/criptografadas de ponta a ponta/.test(files['privacy.html'])&&/Mensagens antigas ou criadas por versões anteriores/.test(files['privacy.html'])&&/compartilhamento de atividade/.test(files['privacy.html'])&&/cookies/.test(files['privacy.html'])&&/direitos/.test(files['privacy.html']));
check('terms and truthful existing contact are supplied',files['terms.html'].includes('Termos e condições')&&[files['privacy.html'],files['terms.html'],files['support.html']].every(html=>html.includes('https://github.com/rafaelmingroni/mingrx-app/issues')&&html.includes('Os chamados são públicos')&&!html.includes('{{')));
check('download uses a verified repository asset and has a working static fallback',files['app.js'].includes('/releases/latest')&&files['app.js'].includes('controller.abort()')&&!files['app.js'].includes("dataset.loading='true'")&&files['index.html'].includes('https://github.com/rafaelmingroni/mingrx-app/releases/latest'));
check('invitation handoff is preserved',files['app.js'].includes("params.has('invite')")&&files['invite.js'].includes('mingrx://join/'));
check('specific cookie, refund, accessibility and attribution pages',pages.includes('cookies.html')&&pages.includes('refunds.html')&&pages.includes('accessibility.html')&&pages.includes('about.html'));
check('no unnecessary data collection forms',pages.every(name=>!/<form\b|<input\b|<textarea\b/i.test(files[name])));
check('future email is explicitly marked inactive',files['about.html'].includes('Rafael Mingroni')&&files['about.html'].includes('atendimento em ativação')&&!pages.some(name=>/href="mailto:mingrxapp@gmail\.com/.test(files[name])));
check('robots and sitemap use the actual custom domain',files['robots.txt'].includes('https://mingrx.site/sitemap.xml')&&files['sitemap.xml'].includes('<loc>https://mingrx.site/</loc>'));
const favicon=await readFile(path.join(root,'favicon.ico'));
check('ICO favicon has actual icon entries',favicon.readUInt16LE(2)===1&&favicon.readUInt16LE(4)>=1);
for(const name of pages){
  const html=files[name];
  check(`${name}: viewport and favicon`,/name="viewport"/.test(html)&&/rel="icon"[^>]+favicon\.ico/.test(html));
  check(`${name}: one main heading`,[...html.matchAll(/<h1\b/g)].length===1);
  const idValues=[...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>id);
  const ids=new Set(idValues);
  check(`${name}: unique anchor IDs`,ids.size===idValues.length);
  check(`${name}: local-script security policy`,html.includes("script-src 'self'")&&!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html));
  for(const [,attr,url]of html.matchAll(/\b(href|src)="([^"]+)"/g)){
    if(/^(?:https?:|mailto:|mingrx:)/.test(url)||url==='#')continue;
    const [raw,fragment]=url.split('#');
    const clean=raw.split('?')[0];
    const target=raw?path.resolve(root,clean.startsWith('/')?'.'+clean:clean):path.join(root,name);
    check(`${name}: local ${attr} ${url}`,(target===root.replace(/\/$/,'')||target.startsWith(root))&&await stat(target).then(()=>true,()=>false));
    if(fragment){const targetHtml=raw?await readFile(target,'utf8'):html;check(`${name}: anchor ${fragment}`,new RegExp(`\\bid="${fragment}"`).test(targetHtml));}
  }
}
console.log('Site: all design, metadata, legal and local-link checks passed.');
