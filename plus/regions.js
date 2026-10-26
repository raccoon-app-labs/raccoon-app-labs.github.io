/* Currency selects a catalogue, never an account region or session. */
(() => {
 'use strict';
 const root=document.documentElement,panel=document.querySelector('[data-ru-region-panel]'),picker=document.querySelector('[data-commerce-region]');
 if(!panel || !picker)return;
 const pass=document.querySelector('.pass-section'),ticket=pass.querySelector('.plus-pass'),usd=pass.querySelector('.pass-checkout');
 const plans=document.createElement('div');plans.className='currency-plans';ticket.append(plans);plans.append(picker,panel,usd);
 picker.classList.add('currency-picker');picker.dataset.noL10n='';picker.dataset.currencyReady='true';
 const footer=[...document.querySelectorAll('.store-footer a[href]')].filter(a=>/\/(offer|privacy)\//.test(a.getAttribute('href'))),originalFooter=new Map(footer.map(a=>[a,a.getAttribute('href')]));
 const region=()=>new URLSearchParams(location.search).get('region')==='ru'?'ru':'global';
 const app=()=>['keys','bloom'].includes(root.dataset.app)?root.dataset.app:null;
 const language=()=>window.HanziLocale?.code || root.lang || 'en';
 const t=key=>(window.HanziCurrencyCopy?.[language()] || window.HanziCurrencyCopy?.en || {})[key] || key;
 const set=(node,value)=>{if(node && node.textContent!==value){node.dataset.noL10n='';node.textContent=value;}};
 let entrance;
 function url(value){const u=new URL(location.href);u.searchParams.set('region',value);u.searchParams.set('app',app()||'bloom');u.searchParams.set('lang',language());return u;}
 function checkout(plan){const u=new URL(region()==='ru'?'/apps/hanzi-bloom/plus/checkout/':'/en/apps/hanzi-bloom/plus/checkout/',location.href);u.searchParams.set('app',app()||'bloom');u.searchParams.set('lang',language());if(plan)u.searchParams.set('plan',plan);return u.href;}
 function render(){
  const ru=region()==='ru',hanzi=!!app();root.dataset.accountRegion=ru?'ru':'global';root.dataset.currencyUi='ready';
  for(const node of document.querySelectorAll('#app-panel,#hanzi-content>.how-section,#hanzi-content>.faq-section'))node.hidden=false;
  pass.hidden=false;pass.id=hanzi?'plus':'hanzi-plus';panel.id='ru-pricing';panel.hidden=!ru || !hanzi;usd.hidden=ru || !hanzi;
  picker.setAttribute('aria-label',t('currency'));set(picker.querySelector(':scope>p'),t('currency'));set(picker.querySelector(':scope>p:last-child'),t('hint'));
  picker.querySelectorAll('[data-russian-catalog],[data-international-catalog]').forEach(link=>{
   const rub=link.hasAttribute('data-russian-catalog');link.href=url(rub?'ru':'global').href;link.setAttribute('aria-current',String(rub===ru));
   set(link.querySelector('strong'),t(rub?'rub':'usd'));set(link.querySelector('small'),rub?'RUB':t('soon')+' · USD');
  });
  panel.querySelectorAll('.ru-price-card>.eyebrow').forEach(node=>set(node,'RUB · ₽'));
  const unavailable=usd.querySelector('[data-checkout]');unavailable.removeAttribute('href');unavailable.setAttribute('aria-disabled','true');unavailable.setAttribute('role','button');unavailable.tabIndex=0;unavailable.dataset.currencyUnavailable='';
  set(unavailable.querySelector('#pass-action'),t('soon'));set(usd.querySelector('.pass-availability'),t('usdNotice'));set(usd.querySelector(':scope>p'),t('onePayment'));set(usd.querySelector('.pass-term'),t('month'));
  if(hanzi){document.querySelector('.skip-link').href='#app-panel';for(const link of document.querySelectorAll('.hero-actions [data-checkout],#mobile-buybar [data-checkout]'))link.href='#plus';document.querySelector('.account-link').href=checkout();}
  for(const link of panel.querySelectorAll('[data-ru-web-plan]'))link.href=checkout(link.dataset.ruWebPlan);
  for(const link of footer){const u=new URL(originalFooter.get(link),location.href);if(hanzi&&ru)u.pathname='/apps/hanzi-bloom/plus/checkout/'+(u.pathname.includes('/offer/')?'offer/':'privacy/');u.searchParams.set('lang',language());link.href=u.href;}
  for(const link of panel.querySelectorAll('[data-ru-document]')){const u=new URL(link.href);u.searchParams.set('lang',language());link.href=u.href;}
  const how=document.querySelectorAll('.how-steps p');set(how[0],t('email'));set(how[1],t('pay'));set(how[2],t('access'));
  const answers=document.querySelectorAll('.faq-answer p');set(answers[0],t('shared'));set(answers[1],t('onePayment'));
  const answer=answers[2];if(answer){answer.dataset.noL10n='';const help=answer.querySelector('a');if(help && answer.firstChild?.nodeType===3){const value=t('restore')+' ';if(answer.firstChild.textContent!==value)answer.firstChild.textContent=value;while(help.nextSibling)help.nextSibling.remove();}}
 }
 picker.addEventListener('click',event=>{
  const link=event.target.closest('[data-russian-catalog],[data-international-catalog]');if(!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
  event.preventDefault();const value=link.hasAttribute('data-russian-catalog')?'ru':'global',changed=region()!==value;if(changed)history.pushState(null,'',url(value));render();entrance?.cancel();
  if(changed && !matchMedia('(prefers-reduced-motion: reduce)').matches && root.dataset.motion!=='reduced')entrance=(value==='ru'?panel:usd).animate([{opacity:.35,transform:'perspective(700px) rotateX(-5deg) translateY(10px)'},{opacity:1,transform:'perspective(700px) rotateX(0) translateY(0)'}],{duration:380,easing:'cubic-bezier(.16,1,.3,1)'});
 });
 document.addEventListener('click',event=>{if(event.target.closest('[data-currency-unavailable]')){event.preventDefault();event.stopImmediatePropagation();}},true);
 addEventListener('raccoon:appchange',render);addEventListener('hanzi:languagechange',render);addEventListener('popstate',render);render();
})();
