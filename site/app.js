const params=new URLSearchParams(location.search);const invite=params.get('invite');if(invite){location.replace(`./invite.html?invite=${encodeURIComponent(invite)}`)}

const menuButton=document.querySelector('.mobile-menu');const nav=document.querySelector('.main-nav');if(menuButton&&nav){menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'✕':'☰'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.textContent='☰'}))}

const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();

const downloadLinks=[...document.querySelectorAll('.download-link')];downloadLinks.forEach(link=>link.dataset.loading='true');
fetch('https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest',{headers:{Accept:'application/vnd.github+json'}})
  .then(r=>r.ok?r.json():Promise.reject(new Error('release unavailable')))
  .then(release=>{const asset=(release.assets||[]).find(a=>/^Mingrx-Setup-.*-x64\.exe$/i.test(a.name));if(asset?.browser_download_url){downloadLinks.forEach(link=>{link.href=asset.browser_download_url;link.removeAttribute('target')})}const version=String(release.tag_name||'').replace(/^v/i,'');if(version){document.querySelectorAll('.release-note').forEach(note=>{note.textContent=`Mingrx ${version} · Windows 10/11 · Atualizações automáticas · Grátis`})}})
  .catch(()=>{})
  .finally(()=>downloadLinks.forEach(link=>delete link.dataset.loading));

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduceMotion&&'IntersectionObserver'in window){
  const revealTargets=[...document.querySelectorAll('.section,.trust-row>div,.feature-grid>article,.security-cards>div,.performance-card,.final-cta')];
  revealTargets.forEach(el=>el.classList.add('reveal-ready'));
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal-in');observer.unobserve(entry.target)}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  revealTargets.forEach(el=>observer.observe(el));

  const heroVisual=document.querySelector('.hero-visual');const monitor=document.querySelector('.monitor-wrap');
  if(heroVisual&&monitor&&window.matchMedia('(pointer:fine)').matches){
    heroVisual.addEventListener('pointermove',event=>{const r=heroVisual.getBoundingClientRect();const x=(event.clientX-r.left)/r.width-.5;const y=(event.clientY-r.top)/r.height-.5;monitor.style.transform=`perspective(1200px) rotateY(${-5+x*3}deg) rotateX(${1-y*2}deg) translate3d(${x*5}px,${y*4}px,0)`});
    heroVisual.addEventListener('pointerleave',()=>{monitor.style.transform=''});
  }
}