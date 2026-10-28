import {apps} from './catalog.js?v=20261026-fast';
import {installStoreEffects} from './effects.js?v=ba5301033dd6';
import {installFaqReveals} from './faq.js?v=20261026-fold';
import {installTicketTear} from './ticket.js?v=20261026-night';

const el = id => document.getElementById(id);
// Independent shops share navigation, never the Hanzi billing catalog.
const shops = {stories:{name:'Magical Stories',icon:'/assets/apps/stories-icon.webp',route:'/apps/magical-stories/'},neon:{name:'Neon Cyber Wall Kicker',icon:'/assets/apps/neon-icon.webp',route:'/apps/neon-cyber-wall-kicker/'}};
const tabs = [...document.querySelectorAll('[data-app-tab]')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const scene = el('scene');
const marker = document.querySelector('.tab-marker');
let current = 'bloom', cardIndex = 0, pointerFrame = 0, pointer = {x:0, y:0};
let sceneAnimations = [];
let panelAnimation;
let userReducedMotion = false;
const reducedMotion = () => motion.matches || userReducedMotion;
const interactionEffects = installStoreEffects({reducedMotion, finePointer});
const faqReveals = installFaqReveals({reducedMotion});
const ticketTear = installTicketTear({reducedMotion});

function moveMarker() {
  const selected = tabs.find(tab => tab.dataset.appTab === current);
  marker.style.width = selected.offsetWidth + 'px';
  marker.style.transform = `translateX(${selected.offsetLeft}px)`;
  marker.style.top = selected.offsetTop + 'px';
  marker.style.height = selected.offsetHeight + 'px';
  document.documentElement.style.setProperty('--hub-nav-height', Math.ceil(document.querySelector('.app-nav').offsetHeight) + 'px');
}

function finishSelection({id, changed, updateUrl, announce}) {
  moveMarker();
  if (updateUrl) {
    const url=new URL(location.href);url.searchParams.set('app',id);url.hash='';
    if(changed)history.pushState(null,'',url.pathname+url.search);else history.replaceState(null,'',url.pathname+url.search);
    document.querySelector('main').scrollIntoView({block:'start',behavior:'instant'});
  }
  window.dispatchEvent(new CustomEvent('raccoon:appchange',{detail:{app:id}}));
  if(announce)el('app-announcement').textContent=shops[id]?shops[id].name:apps[id].name+' selected. The same Hanzi Plus includes both apps.';
  panelAnimation?.cancel();
  if(changed && updateUrl && !reducedMotion())panelAnimation=(shops[id]?el(id+'-panel'):el('hanzi-content')).animate([
    {opacity:.2,translate:'0 18px',rotate:'-.35deg'},{opacity:1,translate:'0 0',rotate:'0deg'}
  ],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'});
}

function animateScene() {
  sceneAnimations.forEach(animation => animation.cancel());
  sceneAnimations = [];
  if (reducedMotion()) return;
  for (const [index, node] of [el('scene-panda'), el('word-ticket'), el('floating-note'), el('scene-play')].entries()) {
    sceneAnimations.push(node.animate([
      {opacity:0, translate:`${index % 2 ? '-18px' : '20px'} 28px`, scale:'.92', filter:'blur(4px)'},
      {opacity:1, translate:'0 0', scale:'1', filter:'blur(0)'}
    ], {duration:650, delay:index * 60, easing:'cubic-bezier(.16,1,.3,1)'}));
  }
}

function renderCard(animate = false) {
  const card = apps[current].cards[cardIndex];
  el('ticket-word').textContent = card.word;
  el('ticket-reading').textContent = card.reading;
  el('ticket-meaning').textContent = card.meaning;
  el('ticket-label').textContent = card.label;
  el('ticket-number').textContent = String(cardIndex + 1).padStart(2, '0');
  el('word-ticket').classList.toggle('is-assembled', current === 'keys' && cardIndex === 1);
  el('scene-play-label').textContent = current === 'keys' && cardIndex === 1 ? 'See the little pieces' : apps[current].demoAction;
  if (animate) el('app-announcement').textContent = card.word + '. ' + card.reading + '. ' + card.meaning + '.';
  if (animate && !reducedMotion()) {
    el('word-ticket').animate([
      {rotate:'-6deg', translate:'0 0', scale:'1'},
      {rotate:'5deg', translate:'0 -14px', scale:'1.055', offset:.45},
      {rotate:'-6deg', translate:'0 0', scale:'1'}
    ], {duration:650, easing:'cubic-bezier(.2,.8,.2,1)'});
    particles();
  }
}

function particles() {
  const layer = el('scene-particles');
  layer.replaceChildren();
  for (let index = 0; index < 9; index++) {
    const piece = document.createElement('i');
    const angle = index / 9 * Math.PI * 2;
    piece.style.setProperty('--piece-color', index % 2 ? 'var(--accent)' : 'var(--mint)');
    layer.append(piece);
    const animation = piece.animate([
      {opacity:0, transform:'translate(0,0) scale(.3)'},
      {opacity:1, offset:.18},
      {opacity:0, transform:`translate(${Math.cos(angle) * 105}px,${Math.sin(angle) * 90 - 35}px) rotate(${index * 47}deg) scale(.1)`}
    ], {duration:850, easing:'cubic-bezier(.16,1,.3,1)'});
    animation.onfinish = () => piece.remove();
  }
}

function selectApp(id, {updateUrl = true, announce = true} = {}) {
  if (!Object.hasOwn(shops,id) && !Object.hasOwn(apps, id)) return;
  const changed = current !== id;
  current = id; cardIndex = 0;
  const independent=Object.hasOwn(shops,id);
  const app = independent?shops[id]:apps[id];
  document.documentElement.dataset.app = id;
  document.title = independent?app.name+' · Shop & bonuses':app.name + ' Plus · The little app shop';
  el('app-favicon').href = app.icon;
  for (const tab of tabs) {
    const selected = tab.dataset.appTab === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  el('hanzi-content').hidden=independent;
  for(const key of Object.keys(shops))el(key+'-panel').hidden=key!==id;
  el('hanzi-content').setAttribute('aria-labelledby',independent?'tab-bloom':'tab-'+id);
  document.querySelector('.pass-section').id=independent?'hanzi-plus':'plus';
  const offers=document.querySelector('#stories-panel .offers-section');offers.id=id==='stories'?'plus':'stories-offers';
  document.querySelector('.skip-link').href=independent?'#'+id+'-panel':'#app-panel';
  const account=document.querySelector('.account-link');
  account.replaceChildren(document.createTextNode(independent?'Back to app':'Already have Plus?'));
  const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';account.append(arrow);
  if(independent){
    account.removeAttribute('data-checkout');account.href=app.route;
    el('mobile-buybar').hidden=true;
    sceneAnimations.forEach(animation=>animation.cancel());sceneAnimations=[];
    cancelAnimationFrame(pointerFrame);pointerFrame=0;resetPointer();
    finishSelection({id,changed,updateUrl,announce});return;
  }
  account.setAttribute('data-checkout','');
  el('title-first').textContent = app.title[0];
  el('title-second').replaceChildren(document.createTextNode(app.title[1]));
  const emphasis = document.createElement('em'); emphasis.textContent = app.title[2]; el('title-second').append(emphasis);
  const fields = {'hero-eyebrow':app.eyebrow, 'hero-description':app.description, 'hero-fact':app.fact,
    'scene-annotation':app.annotation, 'note-text':app.note, 'scene-footer':app.footer,
    'included-title':app.featureTitle, 'feature-word':app.miniWord, 'feature-mini-label':app.miniLabel,
    'feature-sound-label':app.soundLabel, 'feature-progress-label':app.progressLabel,
    'content-note':app.contentNote, 'pass-action':'Continue with ' + app.shortName};
  for (const [id, text] of Object.entries(fields)) el(id).textContent = text;
  app.features.forEach(([title, copy], index) => {
    el('feature-title-' + (index + 1)).textContent = title;
    el('feature-copy-' + (index + 1)).textContent = copy;
  });
  const featureDemo = document.querySelector('.sound-bars');
  featureDemo.classList.toggle('component-pieces', id === 'keys');
  featureDemo.replaceChildren();
  for (const character of id === 'keys' ? ['日', '+', '月', '明'] : Array(9).fill(null)) {
    const item = document.createElement(id === 'keys' ? 'span' : 'i');
    if (character) item.textContent = character;
    featureDemo.append(item);
  }
  const panda = el('scene-panda');
  panda.sizes = app.pandaSizes; panda.srcset = app.pandaSrcset;
  panda.src = app.panda; panda.alt = app.pandaAlt;
  scene.setAttribute('aria-label', 'An interactive peek at ' + app.name);
  el('scene-play').setAttribute('aria-label', app.demoAria);
  for (const link of document.querySelectorAll('[data-checkout]')) link.href = app.checkout;
  for (const link of document.querySelectorAll('[data-russian-catalog],[data-international-catalog]')) {
    const target = new URL(link.href); target.searchParams.set('app', id);
    const language = new URLSearchParams(location.search).get('lang');
    if (language) target.searchParams.set('lang', language);
    link.href = target.href;
  }
  renderCard(); finishSelection({id,changed,updateUrl,announce});
  if (changed) animateScene();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => { ticketTear.cancel(); selectApp(tab.dataset.appTab); });
  tab.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next;
    if (event.key === 'ArrowRight') next = (index + (document.dir === 'rtl' ? -1 : 1) + tabs.length) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + (document.dir === 'rtl' ? 1 : -1) + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); tabs[next].focus(); selectApp(tabs[next].dataset.appTab); }
  });
  tab.addEventListener('pointerenter', () => {
    if (!finePointer.matches || navigator.connection?.saveData || tab.dataset.appTab === current) return;
    const app = apps[tab.dataset.appTab], preload = new Image();
    if(!app)return;
    preload.sizes = app.pandaSizes; preload.srcset = app.pandaSrcset; preload.src = app.panda;
  }, {once:true});
});

el('scene-play').addEventListener('click', () => { if(!apps[current])return;cardIndex = (cardIndex + 1) % apps[current].cards.length; renderCard(true); });

function resetPointer() {
  pointer = {x:0, y:0};
  scene.style.setProperty('--mx', '0px'); scene.style.setProperty('--my', '0px');
}
scene.addEventListener('pointermove', event => {
  if (reducedMotion() || !finePointer.matches) return;
  const bounds = scene.getBoundingClientRect();
  pointer = {x:((event.clientX - bounds.left) / bounds.width - .5) * 14,
    y:((event.clientY - bounds.top) / bounds.height - .5) * 12};
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    scene.style.setProperty('--mx', pointer.x + 'px'); scene.style.setProperty('--my', pointer.y + 'px'); pointerFrame = 0;
  });
});
scene.addEventListener('pointerleave', resetPointer);
function syncMotion() {
  document.documentElement.dataset.motion = reducedMotion() ? 'reduced' : 'full';
  el('motion-toggle').setAttribute('aria-pressed', String(reducedMotion()));
  el('motion-toggle').textContent = reducedMotion() ? 'Motion reduced' : 'Less motion';
  el('motion-toggle').disabled = motion.matches;
  el('motion-toggle').title = motion.matches ? 'Reduced motion follows your device setting.' : 'Reduce decorative motion';
  if (reducedMotion()) {
    ticketTear.finish();
    faqReveals.finishAll();
    interactionEffects.clear();
    document.getAnimations().forEach(animation => animation.cancel());
    resetPointer(); el('scene-particles').replaceChildren();
  }
}
el('motion-toggle').addEventListener('click', () => { userReducedMotion = !userReducedMotion; syncMotion(); });
motion.addEventListener('change', syncMotion);

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(entry => { entry.target.classList.add('is-visible'); reveal.unobserve(entry.target); });
  }, {threshold:.12});
  document.querySelectorAll('[data-reveal]').forEach(node => { node.classList.add('will-reveal'); reveal.observe(node); });
  const passVisible = new IntersectionObserver(entries => {
    const pass = entries[0]; el('mobile-buybar').hidden = !!shops[current] || pass.isIntersecting || pass.boundingClientRect.top > innerHeight;
  }, {threshold:0});
  passVisible.observe(document.querySelector('.plus-pass'));
}

new ResizeObserver(moveMarker).observe(document.querySelector('.app-tabs'));
document.fonts.ready.then(moveMarker);
const requested = new URLSearchParams(location.search).get('app');
selectApp(Object.hasOwn(shops,requested) || Object.hasOwn(apps, requested) ? requested : 'bloom', {updateUrl:false, announce:false});
syncMotion();
if(!shops[current])animateScene();
if(location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start',behavior:'instant'}));
window.addEventListener('popstate',()=>{
  const app=new URLSearchParams(location.search).get('app');selectApp(Object.hasOwn(shops,app) || Object.hasOwn(apps,app)?app:'bloom',{updateUrl:false,announce:false});
  if(location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start',behavior:'instant'}));
});

window.addEventListener('hanzi:languagechange', moveMarker);
