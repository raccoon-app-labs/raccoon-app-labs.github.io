/* Presentation only: language never changes the checkout contract, region or session. */
(() => {
  'use strict';
  const data = window.HANZI_PLUS_MESSAGES;
  if (!data?.en) return;
  const languages = [
    ['en','English','English','Hello','Aa'], ['ru','Русский','Russian','Привет','Я'],
    ['es','Español','Spanish','Hola','Ñ'], ['pt','Português','Portuguese','Olá','Ã'],
    ['fr','Français','French','Bonjour','é'], ['de','Deutsch','German','Hallo','ß'],
    ['ar','العربية','Arabic','مرحبًا','ع'], ['hi','हिन्दी','Hindi','नमस्ते','ह'],
    ['id','Bahasa Indonesia','Indonesian','Halo','Aa'], ['ja','日本語','Japanese','こんにちは','あ'],
    ['ko','한국어','Korean','안녕하세요','한'], ['tr','Türkçe','Turkish','Merhaba','İ']
  ].filter(([code]) => data[code]);
  // Self-hosted vector flags render consistently on Windows, Android and iOS.
  // They are visual language hints; the native names remain the actual labels.
  const flagShapes = {
    en:'<path fill="#17366b" d="M0 0h32v24H0z"/><path stroke="#fff" stroke-width="6" d="m0 0 32 24M32 0 0 24"/><path stroke="#d62e42" stroke-width="2" d="m0 0 32 24M32 0 0 24"/><path stroke="#fff" stroke-width="9" d="M16 0v24M0 12h32"/><path stroke="#d62e42" stroke-width="5" d="M16 0v24M0 12h32"/>',
    ru:'<path fill="#fff" d="M0 0h32v8H0z"/><path fill="#2459ba" d="M0 8h32v8H0z"/><path fill="#df3d4d" d="M0 16h32v8H0z"/>',
    es:'<path fill="#bd273b" d="M0 0h32v24H0z"/><path fill="#ffcf48" d="M0 6h32v12H0z"/><path fill="#bd273b" d="M8 9h5v6H8z"/><path fill="#f5a53b" d="M9 10h3v3H9z"/>',
    pt:'<path fill="#198653" d="M0 0h32v24H0z"/><path fill="#ffcf48" d="m16 3 13 9-13 9L3 12z"/><circle cx="16" cy="12" r="6" fill="#264d91"/><path d="M10.5 10.5q6-1 11 4" fill="none" stroke="#fff" stroke-width="1.4"/>',
    fr:'<path fill="#2d4d99" d="M0 0h11v24H0z"/><path fill="#fff" d="M11 0h10v24H11z"/><path fill="#e24d56" d="M21 0h11v24H21z"/>',
    de:'<path fill="#292929" d="M0 0h32v8H0z"/><path fill="#d84142" d="M0 8h32v8H0z"/><path fill="#f5c74d" d="M0 16h32v8H0z"/>',
    ar:'<path fill="#2b9a65" d="M0 0h32v8H0z"/><path fill="#fff" d="M0 8h32v8H0z"/><path fill="#292929" d="M0 16h32v8H0z"/><path fill="#df3c48" d="M0 0h8v24H0z"/>',
    hi:'<path fill="#ed9a4b" d="M0 0h32v8H0z"/><path fill="#fff" d="M0 8h32v8H0z"/><path fill="#2d9662" d="M0 16h32v8H0z"/><g fill="none" stroke="#2b5094" stroke-width=".7"><circle cx="16" cy="12" r="3"/><path d="M13 12h6M16 9v6m-2.1-5.1 4.2 4.2m0-4.2-4.2 4.2"/></g>',
    id:'<path fill="#df3f49" d="M0 0h32v12H0z"/><path fill="#fff" d="M0 12h32v12H0z"/>',
    ja:'<path fill="#fff" d="M0 0h32v24H0z"/><circle cx="16" cy="12" r="6" fill="#ce3655"/>',
    ko:'<path fill="#fff" d="M0 0h32v24H0z"/><g transform="rotate(28 16 12)"><circle cx="16" cy="12" r="5" fill="#cf4050"/><path d="M11 12a5 5 0 0 0 10 0c0-3.3-5-3.3-5 0s-5 3.3-5 0" fill="#315c9b"/></g><g stroke="#303239" stroke-width="1.1"><path d="m5 6 3-3M6.5 7.5l3-3M8 9l3-3m10 12 3-3m-1.5 4.5 3-3m-1.5 4.5 3-3M5 18l1-1m1-1 1-1m-1.5 4.5 1-1m1-1 1-1M8 21l1-1m1-1 1-1m10-12 1 1m1 1 1 1m-1.5-4.5 1 1m1 1 1 1M24 3l1 1m1 1 1 1"/></g>',
    tr:'<path fill="#db3549" d="M0 0h32v24H0z"/><circle cx="13" cy="12" r="7" fill="#fff"/><circle cx="15" cy="11" r="5.6" fill="#db3549"/><path fill="#fff" d="m23 8 1.1 2.5 2.7.3-2 1.8.6 2.7-2.4-1.4-2.4 1.4.6-2.7-2-1.8 2.7-.3z"/>'
  };
  function flag(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 32 24'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
    svg.classList.add('language-flag'); svg.innerHTML = flagShapes[id]; return svg;
  }
  const normalize = value => value.replace(/\s+/gu,' ').trim();
  const valid = value => languages.some(([code]) => code === value);
  const baseCode = value => String(value || '').toLowerCase().split(/[-_]/u)[0];
  const storageKey = 'hanzi-plus-language';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches || document.documentElement.dataset.motion === 'reduced';
  const textState = new WeakMap(), attributeState = new WeakMap();
  const ownedAnimations = new Set();
  let code = 'en', changing = false;
  const templates = Object.keys(data.en).filter(key => /\{\w+\}/u.test(key)).map(key => {
    const names = [];
    const escaped = key.split(/(\{\w+\})/u).map(part => {
      if (/^\{\w+\}$/u.test(part)) { names.push(part.slice(1,-1)); return '(.+?)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
    }).join('');
    return {key, names, pattern:new RegExp('^' + escaped + '$','u')};
  });
  function t(key, params = {}) {
    return (data[code][key] ?? data.en[key] ?? key).replace(/\{(\w+)\}/gu, (all, name) => params[name] ?? all);
  }
  function translate(source) {
    const value = normalize(source);
    let result = data[code][value];
    if (result === undefined) {
      for (const template of templates) {
        const match = value.match(template.pattern);
        if (match) { result = t(template.key, Object.fromEntries(template.names.map((name,i) => [name,match[i+1]]))); break; }
      }
    }
    if (result === undefined && /^Hanzi (Bloom|Keys) Plus · The little app shop$/u.test(value))
      result = t('Hanzi Plus · The little app shop').replace('Hanzi Plus',value.split(' · ')[0]);
    if (result === undefined) return source;
    return (source.match(/^\s*/u)?.[0] || '') + result + (source.match(/\s*$/u)?.[0] || '');
  }
  function skipped(node) { return node.parentElement?.closest('script,style,noscript,[data-no-l10n]'); }
  function text(node) {
    if (skipped(node) || !normalize(node.data)) return;
    let saved = textState.get(node);
    if (!saved || node.data !== saved.last) saved = {source:node.data,last:node.data};
    const result = translate(saved.source);
    saved.last = result; textState.set(node,saved);
    if (node.data !== result) node.data = result;
  }
  const attrs = ['aria-label','placeholder','title','alt'];
  function attributes(node) {
    if (node.closest?.('[data-no-l10n]')) return;
    let states = attributeState.get(node);
    if (!states) { states = {}; attributeState.set(node,states); }
    for (const name of attrs) {
      if (!node.hasAttribute(name)) continue;
      const value = node.getAttribute(name);
      let saved = states[name];
      if (!saved || value !== saved.last) saved = {source:value,last:value};
      const result = translate(saved.source); saved.last = result; states[name] = saved;
      if (value !== result) node.setAttribute(name,result);
    }
    if (node.matches('a[href]')) {
      const raw = node.getAttribute('href');
      if (!raw || raw.startsWith('#')) return;
      try {
        const url = new URL(raw, location.href);
        if (url.origin === location.origin && (url.pathname.startsWith('/plus/') || url.pathname.startsWith('/en/apps/hanzi-bloom/plus/'))) {
          url.searchParams.set('lang',code);
          const next = url.pathname + url.search + url.hash;
          if (raw !== next) node.setAttribute('href',next);
        }
      } catch { /* Unrelated links are not language controls. */ }
    }
  }
  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) { text(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.matches?.('script,style,noscript,[data-no-l10n]')) return;
    if (root.nodeType === Node.ELEMENT_NODE) attributes(root);
    const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) text(walker.currentNode);
    root.querySelectorAll('[aria-label],[placeholder],[title],[alt],a[href]').forEach(attributes);
  }
  function initialLanguage() {
    const query = baseCode(new URLSearchParams(location.search).get('lang'));
    if (valid(query)) return query;
    try { const saved = localStorage.getItem(storageKey); if (valid(saved)) return saved; } catch {}
    return (navigator.languages || [navigator.language]).map(baseCode).find(valid) || 'en';
  }
  const host = document.querySelector('header');
  if (!host) return;
  const utility = document.createElement('div'); utility.className = 'language-utility';
  const accountLink = [...host.children].find(node => node.matches('a') && !node.matches('.shop-brand,.brand'));
  host.classList.add('language-host');
  if (accountLink) utility.append(accountLink);
  const launch = document.createElement('button');
  launch.type = 'button'; launch.className = 'language-launch'; launch.dataset.languageControl = ''; launch.dataset.noL10n = '';
  launch.setAttribute('aria-haspopup','dialog'); launch.setAttribute('aria-controls','language-dialog'); launch.setAttribute('aria-expanded','false');
  const paper = document.createElement('span'); paper.className = 'language-papers'; paper.setAttribute('aria-hidden','true');
  const current = document.createElement('span'); current.className = 'language-current';
  const chevron = document.createElement('span'); chevron.className = 'language-chevron'; chevron.setAttribute('aria-hidden','true'); chevron.textContent = '⌄';
  const sparks = document.createElement('span'); sparks.className = 'language-sparks'; sparks.setAttribute('aria-hidden','true');
  for (let i = 0; i < 4; i++) { const spark = document.createElement('i'); spark.textContent = '✦'; sparks.append(spark); }
  launch.append(paper,current,chevron,sparks); utility.append(launch); host.append(utility);
  const dialog = document.createElement('div'); dialog.id = 'language-dialog'; dialog.className = 'language-dropdown'; dialog.dataset.noL10n = '';
  dialog.setAttribute('role','dialog'); dialog.setAttribute('popover','auto');
  const nativePopover = typeof dialog.showPopover === 'function';
  let expanded = false, closeAnimation = null, closeSerial = 0;
  dialog.setAttribute('aria-labelledby','language-title');
  const panel = document.createElement('div'); panel.className = 'language-panel';
  const heading = document.createElement('div'); heading.className = 'language-heading';
  const title = document.createElement('h2'); title.id = 'language-title';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'language-close'; close.textContent = '×'; close.dataset.languageControl = '';
  heading.append(title,close);
  const search = document.createElement('input'); search.type = 'search'; search.className = 'language-search'; search.autocomplete = 'off';
  const grid = document.createElement('div'); grid.className = 'language-grid'; grid.setAttribute('role','listbox'); grid.setAttribute('aria-labelledby','language-title');
  const empty = document.createElement('p'); empty.className = 'language-empty'; empty.hidden = true;
  const note = document.createElement('p'); note.className = 'language-note';
  const device = document.createElement('button'); device.type = 'button'; device.className = 'language-device'; device.dataset.languageControl = '';
  const cards = languages.map(lang => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'language-card';
    button.dataset.languageControl = ''; button.dataset.code = lang[0]; button.setAttribute('role','option');
    const stamp = document.createElement('span'); stamp.className = 'language-stamp'; stamp.append(flag(lang[0])); stamp.setAttribute('aria-hidden','true');
    const label = document.createElement('span'); label.className = 'language-native'; label.textContent = lang[1]; label.lang = lang[0]; label.dir = lang[0] === 'ar' ? 'rtl' : 'ltr';
    const hello = document.createElement('span'); hello.className = 'language-hello'; hello.textContent = lang[3]; hello.lang = lang[0]; hello.dir = label.dir;
    const copy = document.createElement('span'); copy.className = 'language-copy'; copy.append(label,hello);
    const short = document.createElement('span'); short.className = 'language-short'; short.textContent = lang[0].toUpperCase(); short.setAttribute('aria-hidden','true');
    button.append(stamp,copy,short); grid.append(button);
    button.addEventListener('click', () => { setLanguage(lang[0],true); closeDropdown({focus:true}); });
    return button;
  });
  panel.append(heading,search,grid,empty,note,device); dialog.append(panel); document.body.append(dialog);
  const announce = document.createElement('p'); announce.className = 'language-announcement'; announce.setAttribute('aria-live','polite'); announce.dataset.noL10n = ''; document.body.append(announce);
  function refreshPicker() {
    const selected = languages.find(lang => lang[0] === code);
    current.textContent = selected[1]; paper.replaceChildren(flag(code));
    launch.setAttribute('aria-label',t('Language') + ': ' + selected[1]);
    title.textContent = t('Choose your language'); close.setAttribute('aria-label',t('Close language selection'));
    search.placeholder = t('Search languages'); search.setAttribute('aria-label',t('Search languages'));
    note.textContent = t('The page language does not change your payment region or currency.');
    device.textContent = t('Use device language'); empty.textContent = t('No languages found');
    for (const card of cards) { const chosen = card.dataset.code === code; card.setAttribute('aria-selected',String(chosen)); card.tabIndex = chosen ? 0 : -1; }
  }
  function setLanguage(next, persist = false) {
    if (!valid(next)) return;
    code = next; document.documentElement.lang = code; document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    if (persist) {
      try { localStorage.setItem(storageKey,code); } catch {}
      const url = new URL(location.href); url.searchParams.set('lang',code);
      history.replaceState(history.state,'',url.pathname + url.search + url.hash);
    }
    changing = true; scan(document); refreshPicker(); changing = false;
    for (const field of document.querySelectorAll('input[type=email],#code')) {
      if (field.validity.customError) field.setCustomValidity(t('Check your email address or six-digit code.'));
    }
    const description = document.querySelector('meta[name="description"]');
    const summary = document.getElementById('hero-description') || document.querySelector('.garden-note');
    if (description && summary) description.content = summary.textContent;
    dispatchEvent(new CustomEvent('hanzi:languagechange',{detail:{code}}));
    if (persist) {
      announce.textContent = t('Language changed to {language}',{language:languages.find(lang => lang[0] === code)[1]});
      if (!reduced()) {
        track(paper.animate([{transform:'rotateY(0) rotate(-5deg)'},{transform:'rotateY(180deg) rotate(12deg) scale(1.18)',offset:.5},{transform:'rotateY(360deg) rotate(0)'}],
          {duration:620,easing:'cubic-bezier(.2,.8,.2,1)'}));
        [...sparks.children].forEach((spark,i) => {
          const angle = (i*90+35)*Math.PI/180;
          track(spark.animate([{opacity:0,transform:'translate(0,0) scale(.2)'},{opacity:1,offset:.2},
            {opacity:0,transform:`translate(${Math.cos(angle)*35}px,${Math.sin(angle)*29}px) rotate(80deg) scale(.1)`}],{duration:650,delay:i*35,easing:'ease-out'}));
        });
      }
    }
  }
  function track(animation) {
    ownedAnimations.add(animation); animation.finished.then(() => ownedAnimations.delete(animation),() => ownedAnimations.delete(animation)); return animation;
  }
  function positionDropdown() {
    if (!expanded) return;
    const rect = launch.getBoundingClientRect(), viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft || 0)+10, topEdge = (viewport?.offsetTop || 0)+10;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    if (rect.bottom < topEdge || rect.top > topEdge+height) { closeDropdown({animate:false}); return; }
    const menuWidth = Math.min(344,width-20), below = topEdge+height-20-rect.bottom-8, above = rect.top-topEdge-8;
    const upward = below < 240 && above > below;
    const available = Math.max(100,upward ? above : below);
    const maxHeight = Math.min(620,height-20,available);
    const left = Math.max(leftEdge,Math.min(document.dir === 'rtl' ? rect.left : rect.right-menuWidth,leftEdge+width-menuWidth-20));
    dialog.style.width = menuWidth+'px'; dialog.style.maxHeight = maxHeight+'px'; dialog.style.left = left+'px';
    dialog.style.top = (upward ? Math.max(topEdge,rect.top-8-Math.min(dialog.scrollHeight,maxHeight)) : Math.max(topEdge,Math.min(rect.bottom+10,topEdge+height-20-maxHeight)))+'px';
    dialog.dataset.side = upward ? 'above' : 'below';
    dialog.dataset.compact = String(maxHeight < 320);
    dialog.style.transformOrigin = `${Math.max(24,Math.min(menuWidth-24,rect.left+rect.width/2-left))}px ${upward ? '100%' : '0'}`;
  }
  function closeDropdown({focus = false, animate = true} = {}) {
    if (!expanded && !closeAnimation) return;
    expanded = false; launch.setAttribute('aria-expanded','false');
    const serial = ++closeSerial;
    if (closeAnimation) { closeAnimation.cancel(); closeAnimation = null; }
    const finish = () => {
      if (serial !== closeSerial) return;
      closeAnimation = null;
      if (nativePopover && dialog.matches(':popover-open')) dialog.hidePopover();
      delete dialog.dataset.open;
    };
    if (animate && !reduced()) {
      closeAnimation = track(dialog.animate([{opacity:1,transform:'scaleY(1)'},{opacity:0,transform:'scaleY(.92) translateY(-5px)'}],{duration:140,easing:'ease-in'}));
      closeAnimation.finished.then(finish,finish);
    } else finish();
    if (focus) launch.focus({preventScroll:true});
  }
  function openDropdown(focusOption = false) {
    ++closeSerial;
    if (closeAnimation) { closeAnimation.cancel(); closeAnimation = null; }
    search.value = ''; cards.forEach(card => card.hidden = false); empty.hidden = true;
    refreshPicker(); expanded = true; dialog.dataset.open = 'true';
    if (nativePopover && !dialog.matches(':popover-open')) dialog.showPopover();
    launch.setAttribute('aria-expanded','true'); positionDropdown();
    const selectedCard = cards.find(card => card.dataset.code === code);
    grid.scrollTop = Math.max(0,selectedCard.offsetTop-grid.offsetTop-grid.clientHeight/2+selectedCard.offsetHeight/2);
    if (focusOption) cards.find(card => card.dataset.code === code).focus({preventScroll:true}); else search.focus({preventScroll:true});
    if (!reduced()) {
      track(dialog.animate([{opacity:0,transform:'perspective(700px) rotateX(-12deg) scaleY(.85)',clipPath:'inset(0 0 75% 0 round 22px)'},
        {opacity:1,transform:'perspective(700px) rotateX(2deg) scaleY(1.025)',offset:.72},
        {opacity:1,transform:'none',clipPath:'inset(0 0 0 0 round 22px)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'}));
      cards.forEach((card,i) => track(card.animate([{opacity:0,transform:`translate(${i%2 ? 9 : -9}px,-8px) rotate(${i%2 ? 1 : -1}deg)`},
        {opacity:1,transform:'none'}],{duration:280,delay:Math.min(i*22,132),easing:'cubic-bezier(.16,1,.3,1)'})));
    }
  }
  launch.addEventListener('click', () => expanded ? closeDropdown() : openDropdown());
  launch.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault(); if (!expanded) openDropdown(true); else cards.find(card => !card.hidden && card.tabIndex === 0)?.focus();}
  });
  close.addEventListener('click', () => closeDropdown({focus:true}));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDropdown({focus:true}); }
  });
  dialog.addEventListener('toggle', event => {
    if (event.newState === 'closed' && !dialog.matches(':popover-open')) { expanded = false; launch.setAttribute('aria-expanded','false'); delete dialog.dataset.open; }
  });
  document.addEventListener('pointerdown', event => {
    if (expanded && !dialog.contains(event.target) && !launch.contains(event.target)) closeDropdown({animate:false});
  });
  document.addEventListener('focusin', event => {
    if (expanded && !dialog.contains(event.target) && !launch.contains(event.target)) closeDropdown({animate:false});
  });
  search.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      const shown = cards.filter(card => !card.hidden);
      if (shown.length) { event.preventDefault(); shown[event.key === 'ArrowUp' ? shown.length-1 : 0].focus(); }
    }
  });
  search.addEventListener('input', () => {
    const query = search.value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'');
    cards.forEach((card,i) => card.hidden = !languages[i].join(' ').toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').includes(query));
    const shown = cards.filter(card => !card.hidden); empty.hidden = shown.length !== 0;
    if (shown.length && !shown.some(card => card.tabIndex === 0)) shown[0].tabIndex = 0;
  });
  grid.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const shown = cards.filter(card => !card.hidden), index = shown.indexOf(document.activeElement);
    if (index < 0) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const step = {ArrowRight:code === 'ar' ? -1 : 1,ArrowLeft:code === 'ar' ? 1 : -1,ArrowDown:columns,ArrowUp:-columns}[event.key];
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? shown.length-1 : step === undefined ? null : (index+step+shown.length)%shown.length;
    if (next !== null) { event.preventDefault(); cards.forEach(card => card.tabIndex = -1); shown[next].tabIndex = 0; shown[next].focus(); }
  });
  device.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); } catch {}
    const next = (navigator.languages || [navigator.language]).map(baseCode).find(valid) || 'en';
    setLanguage(next,true); closeDropdown({focus:true});
  });
  const observer = new MutationObserver(records => {
    if (changing) return;
    for (const record of records) {
      if (record.type === 'characterData') text(record.target);
      else if (record.type === 'attributes') attributes(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  window.HanziLocale = Object.freeze({get code() {return code;},t,set:next => setLanguage(next,true),languages:languages.map(([id,name])=>({code:id,name}))});
  const otp = document.getElementById('code');
  if (otp) otp.addEventListener('input', () => {
    otp.value = otp.value.replace(/[\u0660-\u0669\u06f0-\u06f9\u0966-\u096f]/gu, digit => {
      const value = digit.codePointAt(0);
      return String(value >= 0x966 ? value-0x966 : value >= 0x6f0 ? value-0x6f0 : value-0x660);
    });
  });
  for (const field of document.querySelectorAll('input[type=email],#code')) {
    field.addEventListener('invalid', () => field.setCustomValidity(t('Check your email address or six-digit code.')));
    field.addEventListener('input', () => field.setCustomValidity(''));
  }
  setLanguage(initialLanguage());
  observer.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...attrs,'href']});
  addEventListener('popstate', () => setLanguage(initialLanguage()));
  window.addEventListener('resize',positionDropdown,{passive:true});
  window.visualViewport?.addEventListener('resize',positionDropdown,{passive:true});
  window.visualViewport?.addEventListener('scroll',positionDropdown,{passive:true});
  document.addEventListener('scroll', event => {
    if (expanded && !dialog.contains(event.target)) positionDropdown();
  },{capture:true,passive:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { closeDropdown({animate:false}); ownedAnimations.forEach(animation => animation.cancel()); ownedAnimations.clear(); }
  });
})();
