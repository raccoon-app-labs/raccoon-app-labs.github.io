/* Runs before first paint. Appearance only; no account or checkout state. */
(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'hanzi-plus-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
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
    meta.content = mode === 'dark' ? '#0d1d24' : '#f5f3ea';
    refresh();
  }
  apply(choice || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', () => { if (!choice) apply(system.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    choice = valid(event.newValue) ? event.newValue : null;
    apply(choice || (system.matches ? 'dark' : 'light'));
  });
  function mount() {
    const header = document.querySelector('header');
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
    let tools = header.querySelector('.language-utility');
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
    new MutationObserver(refresh).observe(root, {attributes:true, attributeFilter:['lang']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
