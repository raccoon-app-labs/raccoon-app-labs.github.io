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
  const first = document.createElement('i'), second = document.createElement('i'); first.textContent = 'Aa'; second.textContent = 'é'; paper.append(first,second);
  const current = document.createElement('span'); current.className = 'language-current';
  launch.append(paper,current); utility.append(launch); host.append(utility);
  const dialog = document.createElement('dialog'); dialog.id = 'language-dialog'; dialog.className = 'language-dialog'; dialog.dataset.noL10n = '';
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
    const stamp = document.createElement('span'); stamp.className = 'language-stamp'; stamp.textContent = lang[4]; stamp.setAttribute('aria-hidden','true');
    const label = document.createElement('span'); label.className = 'language-native'; label.textContent = lang[1]; label.lang = lang[0]; label.dir = lang[0] === 'ar' ? 'rtl' : 'ltr';
    const hello = document.createElement('span'); hello.className = 'language-hello'; hello.textContent = lang[3]; hello.lang = lang[0]; hello.dir = label.dir;
    button.append(stamp,label,hello); grid.append(button);
    button.addEventListener('click', () => { setLanguage(lang[0],true); dialog.close(); launch.focus(); });
    return button;
  });
  panel.append(heading,search,grid,empty,note,device); dialog.append(panel); document.body.append(dialog);
  const announce = document.createElement('p'); announce.className = 'language-announcement'; announce.setAttribute('aria-live','polite'); announce.dataset.noL10n = ''; document.body.append(announce);
  function refreshPicker() {
    const selected = languages.find(lang => lang[0] === code);
    current.textContent = selected[1]; second.textContent = selected[4];
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
        const animation = paper.animate([{transform:'rotateY(0)'},{transform:'rotateY(180deg) scale(1.15)',offset:.5},{transform:'rotateY(360deg)'}],
          {duration:550,easing:'cubic-bezier(.2,.8,.2,1)'});
        ownedAnimations.add(animation); animation.onfinish = () => ownedAnimations.delete(animation);
      }
    }
  }
  launch.addEventListener('click', () => {
    search.value = ''; cards.forEach(card => card.hidden = false); empty.hidden = true;
    refreshPicker(); dialog.showModal(); launch.setAttribute('aria-expanded','true'); search.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { launch.setAttribute('aria-expanded','false'); launch.focus(); });
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
    setLanguage(next,true); dialog.close();
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) {ownedAnimations.forEach(animation => animation.cancel());ownedAnimations.clear();} });
})();
