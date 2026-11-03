const enhancements=document.createElement('link');enhancements.rel='stylesheet';enhancements.href='./enhancements.css';document.head.appendChild(enhancements);

const params=new URLSearchParams(location.search);const invite=params.get('invite');if(invite){location.replace(`./invite.html?invite=${encodeURIComponent(invite)}`)}

const menuButton=document.querySelector('.mobile-menu');const nav=document.querySelector('.main-nav');if(menuButton&&nav){menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.textContent=open?'✕':'☰'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.textContent='☰'}))}

const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();

const downloadLinks=[...document.querySelectorAll('.download-link')];downloadLinks.forEach(link=>link.dataset.loading='true');
fetch('https://api.github.com/repos/rafaelmingroni/mingrx-app/releases/latest',{headers:{Accept:'application/vnd.github+json'}})
  .then(r=>r.ok?r.json():Promise.reject(new Error('release unavailable')))
  .then(release=>{const asset=(release.assets||[]).find(a=>/^Mingrx-Setup-.*-x64\.exe$/i.test(a.name));if(asset?.browser_download_url){downloadLinks.forEach(link=>{link.href=asset.browser_download_url;link.removeAttribute('target')})}const version=String(release.tag_name||'').replace(/^v/i,'');if(version){document.querySelectorAll('.release-note').forEach(note=>{note.textContent=`Mingrx ${version} · Windows 10/11 · Atualizações automáticas · Grátis`})}})
  .catch(()=>{})
  .finally(()=>downloadLinks.forEach(link=>delete link.dataset.loading));
