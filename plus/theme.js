/* Runs before first paint. Appearance only; no account or checkout state. */
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'hanzi-plus-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const worlds = ['studio','bloom','keys','stories','muropolis','neon','food','dokupit'];
  const viewWorld = () => {
    const requested = new URLSearchParams(location.search).get('app');
    if (root.dataset.siteTheme === 'hub') return ['bloom','keys','stories','neon'].includes(requested) ? requested : 'bloom';
    if (root.dataset.siteWorld === 'bloom' && /\/plus\//.test(location.pathname) && requested === 'keys') return 'keys';
    return root.dataset.siteWorld || 'bloom';
  };
  if (root.hasAttribute('data-site-theme')) root.dataset.siteWorld = viewWorld();
  const valid = value => value === 'dark' || value === 'light';
  let choice = null, button, label;
  try { const saved = localStorage.getItem(key); if (valid(saved)) choice = saved; } catch {}
  const words = {
    en:['Dark theme','Night','Day'], ru:['Тёмная тема','Ночь','День'],
    es:['Tema oscuro','Noche','Día'], pt:['Tema escuro','Noite','Dia'],
    fr:['Thème sombre','Nuit','Jour'], de:['Dunkles Design','Nacht','Tag'],
    tr:['Koyu tema','Gece','Gündüz'], id:['Tema gelap','Malam','Siang'],
    ja:['ダークテーマ','夜','昼'], ko:['어두운 테마','밤','낮'],
    ar:['المظهر الداكن','ليل','نهار'], hi:['डार्क थीम','रात','दिन']
  };
  function refresh() {
    if (!button) return;
    const text = words[(root.lang || 'en').split('-')[0]] || words.en;
    const dark = root.dataset.theme === 'dark';
    button.setAttribute('aria-label', text[0]);
    button.setAttribute('aria-pressed', String(dark));
    label.textContent = text[dark ? 1 : 2];
  }
  function apply(mode) {
    root.dataset.theme = mode;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = root.hasAttribute('data-site-theme')
      ? getComputedStyle(root).getPropertyValue('--theme-bg').trim()
      : mode === 'dark' ? '#0d1d24' : '#f5f3ea';
    refresh();
  }
  apply(choice || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', () => { if (!choice) apply(system.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    choice = valid(event.newValue) ? event.newValue : null;
    apply(choice || (system.matches ? 'dark' : 'light'));
  });
  window.addEventListener('raccoon:appchange', event => {
    if (!root.hasAttribute('data-site-theme') || !worlds.includes(event.detail?.app)) return;
    root.dataset.siteWorld = event.detail.app;
    apply(root.dataset.theme);
  });
  function mount() {
    let header = document.querySelector(root.hasAttribute('data-site-theme') ? 'header:not(.magic-header)' : 'header');
    if (!header && root.hasAttribute('data-site-theme')) {
      header=document.createElement('header');header.className='site-appearance-header';
      const home=document.createElement('a');home.href='/';home.textContent='Raccoon App Labs';header.append(home);
      document.body.prepend(header);
    }
    if (!header || document.querySelector('.payment-theme-toggle')) return;
    button = document.createElement('button');
    button.type = 'button'; button.className = 'payment-theme-toggle'; button.dataset.noL10n = '';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    const sun = document.createElementNS(icon.namespaceURI, 'g'); sun.classList.add('theme-sun');
    const circle = document.createElementNS(icon.namespaceURI, 'circle');
    circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '4'); sun.append(circle);
    for (let i = 0; i < 8; i++) {
      const line = document.createElementNS(icon.namespaceURI, 'path'), angle = i * Math.PI / 4;
      line.setAttribute('d', `M${12 + Math.cos(angle) * 7} ${12 + Math.sin(angle) * 7}L${12 + Math.cos(angle) * 9} ${12 + Math.sin(angle) * 9}`);
      sun.append(line);
    }
    const moon = document.createElementNS(icon.namespaceURI, 'path'); moon.classList.add('theme-moon');
    moon.setAttribute('d', 'M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z');
    icon.append(sun, moon); label = document.createElement('span'); button.append(icon, label);
    let tools = root.hasAttribute('data-site-theme') && !root.hasAttribute('data-payment-page')
      ? header.querySelector('.header-tools,nav,.language-utility') : header.querySelector('.language-utility');
    if (!tools) {
      tools = document.createElement('div'); tools.className = 'payment-theme-tools';
      [...header.children].filter(node => node.matches('a:not(:first-child), nav')).forEach(node => tools.append(node));
      header.append(tools);
    }
    header.classList.add('has-payment-theme'); tools.append(button); refresh();
    button.addEventListener('click', () => {
      choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, choice); } catch {}
      apply(choice);
    });
    if (root.hasAttribute('data-site-theme')) {
      // A modal makes its outside header inert. Keep the same single switch
      // usable inside the Stories checkout, then return it when the dialog closes.
      const placeControl = () => {
        const modalHeader=document.querySelector('dialog.magic-checkout[open] .magic-header');
        const target=modalHeader || tools;
        if (button.parentElement!==target) target.insertBefore(button,modalHeader?.querySelector('.magic-close') || null);
      };
      new MutationObserver(placeControl).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
      placeControl();
    }
    new MutationObserver(refresh).observe(root, {attributes:true, attributeFilter:['lang']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
