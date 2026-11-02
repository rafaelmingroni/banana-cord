(() => {
  if (window.__mingrxThemesLoaded) return;
  window.__mingrxThemesLoaded = true;

  const KEY = 'mingrx.theme';
  const THEMES = [
    { id:'system', name:'Sistema', preview:['#f4f5f7','#ffffff','#6848e8','#17191f'], desc:{pt:'Segue automaticamente o tema claro ou escuro do Windows.',en:'Automatically follows Windows light or dark mode.',es:'Sigue automáticamente el modo claro u oscuro de Windows.'} },
    { id:'midnight', name:'Midnight', preview:['#0b0c10','#111218','#7c5cff','#f5f6f8'], desc:{pt:'O visual Mingrx original: grafite profundo e violeta.',en:'The original Mingrx look: deep graphite and violet.',es:'El estilo original de Mingrx: grafito profundo y violeta.'} },
    { id:'pearl', name:'Pearl', preview:['#f4f5f7','#ffffff','#6848e8','#17191f'], desc:{pt:'Claro, limpo e suave para uso durante o dia.',en:'Bright, clean and soft for daytime use.',es:'Claro, limpio y suave para usar durante el día.'} },
    { id:'crimson', name:'Crimson', preview:['#0d0a0c','#151114','#e5485d','#f8f4f5'], desc:{pt:'Preto com vermelho elegante, sem neon exagerado.',en:'Black with restrained premium red accents.',es:'Negro con acentos rojos elegantes y contenidos.'} },
    { id:'ocean', name:'Ocean', preview:['#081014','#0e171f','#3b8df5','#f2f7fb'], desc:{pt:'Azul frio e discreto, com sensação técnica e limpa.',en:'Cool, restrained blue with a clean technical feel.',es:'Azul frío y discreto con una sensación técnica limpia.'} },
    { id:'forest', name:'Forest', preview:['#08100c','#0e1813','#38bf78','#f1f8f4'], desc:{pt:'Verde escuro sóbrio, confortável em sessões longas.',en:'Calm dark green designed for long sessions.',es:'Verde oscuro sobrio, cómodo para sesiones largas.'} },
    { id:'mono', name:'Mono', preview:['#0b0b0c','#121214','#d6d6db','#f4f4f5'], desc:{pt:'Quase sem cor: minimalista e focado no conteúdo.',en:'Almost colorless: minimal and content-focused.',es:'Casi sin color: minimalista y centrado en el contenido.'} }
  ];
  const ids = new Set(THEMES.map(theme => theme.id));
  const media = window.matchMedia?.('(prefers-color-scheme: light)');

  function locale() {
    const raw = window.BananaI18n?.getLocale?.() || document.documentElement.lang || navigator.language || 'pt-BR';
    if (String(raw).toLowerCase().startsWith('en')) return 'en';
    if (String(raw).toLowerCase().startsWith('es')) return 'es';
    return 'pt';
  }

  function strings() {
    const lang = locale();
    return {
      pt:{title:'Aparência',subtitle:'Escolha como o Mingrx deve parecer.',intro:'Os temas alteram apenas cores e superfícies. O layout, desempenho e recursos continuam iguais.',system:'Sistema',note:'A troca é instantânea e fica salva neste dispositivo. “Sistema” acompanha o tema do Windows automaticamente.',applied:'Tema aplicado'},
      en:{title:'Appearance',subtitle:'Choose how Mingrx should look.',intro:'Themes only change colors and surfaces. Layout, performance and features stay the same.',system:'System',note:'Changes apply instantly and are saved on this device. “System” follows Windows automatically.',applied:'Theme applied'},
      es:{title:'Apariencia',subtitle:'Elige cómo debe verse Mingrx.',intro:'Los temas solo cambian colores y superficies. El diseño, rendimiento y funciones siguen iguales.',system:'Sistema',note:'El cambio es instantáneo y se guarda en este dispositivo. “Sistema” sigue Windows automáticamente.',applied:'Tema aplicado'}
    }[lang];
  }

  function current() {
    const fromDom = document.documentElement.dataset.mingrxTheme;
    if (ids.has(fromDom)) return fromDom;
    try {
      const saved = localStorage.getItem(KEY);
      if (ids.has(saved)) return saved;
    } catch {}
    return 'system';
  }

  function systemMode() { return media?.matches ? 'light' : 'dark'; }

  function apply(themeId, persist = true) {
    const id = ids.has(themeId) ? themeId : 'system';
    const root = document.documentElement;
    root.dataset.mingrxTheme = id;
    root.dataset.mingrxSystem = systemMode();
    const light = id === 'pearl' || (id === 'system' && systemMode() === 'light');
    root.style.colorScheme = light ? 'light' : 'dark';
    if (persist) {
      try { localStorage.setItem(KEY, id); } catch {}
    }
    window.dispatchEvent(new CustomEvent('mingrx:theme-change', { detail:{ theme:id, resolved:light ? 'light' : 'dark' } }));
    return id;
  }

  function toastTheme(name) {
    if (typeof window.toast === 'function') {
      try { window.toast(`${strings().applied}: ${name}`, 2200); return; } catch {}
    }
  }

  function themeCard(theme, active) {
    const [bg,panel,accent,text] = theme.preview;
    const s = strings();
    const label = theme.id === 'system' ? s.system : theme.name;
    return `<button type="button" class="mingrx-theme-card ${active===theme.id?'active':''}" data-mingrx-theme-choice="${theme.id}" aria-pressed="${active===theme.id?'true':'false'}">
      <span class="mingrx-theme-preview" style="--preview-bg:${bg};--preview-panel:${panel};--preview-accent:${accent};--preview-text:${text}"></span>
      <span class="mingrx-theme-copy"><b>${label}</b><small>${theme.desc[locale()]}</small></span>
      <span class="mingrx-theme-check">✓</span>
    </button>`;
  }

  function renderAppearance() {
    const area = document.getElementById('settingsArea');
    if (!area) return;
    document.querySelectorAll('.settings-nav-item').forEach(button => button.classList.remove('active'));
    document.getElementById('tabMingrxAppearance')?.classList.add('active');
    const s = strings();
    const title = document.getElementById('settingsTitle');
    const subtitle = document.getElementById('settingsSubtitle');
    if (title) title.textContent = s.title;
    if (subtitle) subtitle.textContent = s.subtitle;
    const active = current();
    area.innerHTML = `<div class="mingrx-theme-panel">
      <p class="mingrx-theme-intro">${s.intro}</p>
      <div class="mingrx-theme-grid">${THEMES.map(theme => themeCard(theme, active)).join('')}</div>
      <div class="mingrx-theme-note"><span>◐</span><span>${s.note}</span></div>
    </div>`;
    for (const button of area.querySelectorAll('[data-mingrx-theme-choice]')) {
      button.addEventListener('click', () => {
        const selected = apply(button.dataset.mingrxThemeChoice);
        const chosen = THEMES.find(theme => theme.id === selected);
        for (const card of area.querySelectorAll('[data-mingrx-theme-choice]')) {
          const isActive = card.dataset.mingrxThemeChoice === selected;
          card.classList.toggle('active', isActive);
          card.setAttribute('aria-pressed', String(isActive));
        }
        toastTheme(chosen?.id === 'system' ? strings().system : chosen?.name || selected);
      });
    }
  }

  function injectAppearanceTab() {
    const nav = document.querySelector('.settings-nav-list');
    if (!nav || document.getElementById('tabMingrxAppearance')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'tabMingrxAppearance';
    button.className = 'settings-nav-item';
    button.innerHTML = `<span>◐</span><b>${strings().title}</b>`;
    button.addEventListener('click', renderAppearance);
    const social = document.getElementById('tabV21Social');
    if (social) nav.insertBefore(button, social);
    else nav.appendChild(button);
  }

  const observer = new MutationObserver(() => injectAppearanceTab());
  observer.observe(document.body, { childList:true, subtree:true });
  injectAppearanceTab();

  media?.addEventListener?.('change', () => {
    document.documentElement.dataset.mingrxSystem = systemMode();
    if (current() === 'system') apply('system', false);
  });

  window.addEventListener('banana:i18n-changed', () => {
    const label = document.querySelector('#tabMingrxAppearance b');
    if (label) label.textContent = strings().title;
    if (document.getElementById('tabMingrxAppearance')?.classList.contains('active')) renderAppearance();
  });

  window.MingrxThemes = Object.freeze({ THEMES, current, apply, renderAppearance, systemMode });
  apply(current(), false);
})();
