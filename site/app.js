const params=new URLSearchParams(location.search);const invite=params.get('invite');if(invite){location.replace(`./invite.html?invite=${encodeURIComponent(invite)}`)}

const menuButton=document.querySelector('.menu-button');const nav=document.querySelector('.topnav');if(menuButton&&nav){menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'FECHAR':'MENU'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.textContent='MENU'}))}

const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();

const downloadLinks=[...document.querySelectorAll('.download-link')];downloadLinks.forEach(link=>link.dataset.loading='true');
fetch('https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest',{headers:{Accept:'application/vnd.github+json'}})
  .then(r=>r.ok?r.json():Promise.reject(new Error('release unavailable')))
  .then(release=>{const asset=(release.assets||[]).find(a=>/^Mingrx-Setup-.*-x64\.exe$/i.test(a.name));if(asset?.browser_download_url){downloadLinks.forEach(link=>{link.href=asset.browser_download_url;link.removeAttribute('target')})}const version=String(release.tag_name||'').replace(/^v/i,'');if(version){document.querySelectorAll('.release-note').forEach(note=>{note.textContent=`Mingrx ${version} · Windows 10/11 · Atualizações automáticas · Grátis`})}})
  .catch(()=>{})
  .finally(()=>downloadLinks.forEach(link=>delete link.dataset.loading));

const timeLine=document.getElementById('timeLine');const returnCopy=document.querySelector('.return-copy');const hour=new Date().getHours();if(timeLine){timeLine.textContent=hour<5?'[ LATE NIGHT · STILL CONNECTED ]':hour<12?'[ MORNING · VOICE · CHAT · SCREEN ]':hour<18?'[ AFTERNOON · YOUR CREW · ONE PLACE ]':'[ NIGHT MODE · YOUR CREW IS ONLINE ]'}
try{const returning=localStorage.getItem('mingrx-site-seen')==='1';if(returnCopy&&returning)returnCopy.textContent='Bom te ver de volta. O Mingrx continua a um clique.';localStorage.setItem('mingrx-site-seen','1')}catch{}

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const reveals=[...document.querySelectorAll('.reveal')];if(reduceMotion||!('IntersectionObserver'in window)){reveals.forEach(el=>el.classList.add('is-visible'))}else{const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}})},{threshold:.12,rootMargin:'0px 0px -45px 0px'});reveals.forEach(el=>observer.observe(el))}

if(!reduceMotion&&window.matchMedia('(pointer:fine)').matches){const glow=document.querySelector('.cursor-glow');window.addEventListener('pointermove',event=>{if(glow){glow.style.left=`${event.clientX}px`;glow.style.top=`${event.clientY}px`}}, {passive:true});const stage=document.querySelector('.product-stage');const app=document.querySelector('.app-shell');if(stage&&app){stage.addEventListener('pointermove',event=>{const r=stage.getBoundingClientRect();const x=(event.clientX-r.left)/r.width-.5;const y=(event.clientY-r.top)/r.height-.5;app.style.transform=`perspective(1400px) rotateY(${-6+x*2.6}deg) rotateX(${1-y*1.8}deg) translate3d(${x*4}px,${y*3}px,0)`});stage.addEventListener('pointerleave',()=>{app.style.transform=''})}}