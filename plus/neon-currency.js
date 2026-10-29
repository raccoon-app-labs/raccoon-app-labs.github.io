/* Display currency only. USD has no published price catalogue or checkout yet. */
(() => {
  'use strict';
  const root=document.documentElement,panel=document.querySelector('#neon-panel');
  const picker=panel?.querySelector('[data-neon-currency-picker]');
  if(!picker)return;
  const links=[...picker.querySelectorAll('[data-neon-currency]')];
  const prices=[...panel.querySelectorAll('[data-neon-price-rub]')];
  const language=()=>window.HanziLocale?.code || root.lang || 'en';
  const t=key=>(window.HanziCurrencyCopy?.[language()] || window.HanziCurrencyCopy?.en || {})[key] || key;
  const currency=()=>new URLSearchParams(location.search).get('region')==='global'?'USD':'RUB';
  const set=(node,value)=>{if(node && node.textContent!==value)node.textContent=value;};
  function url(value){
    const target=new URL(location.href);
    target.searchParams.set('app','neon');target.searchParams.set('region',value==='USD'?'global':'ru');
    target.searchParams.set('lang',language());return target;
  }
  function render(){
    const selected=currency();panel.dataset.neonCurrency=selected;
    set(picker.querySelector('[data-neon-currency-label]'),t('currency'));
    for(const link of links){
      const usd=link.dataset.neonCurrency==='USD';
      link.href=url(link.dataset.neonCurrency).href;
      link.setAttribute('aria-current',String(link.dataset.neonCurrency===selected));
      set(link.querySelector('strong'),t(usd?'usd':'rub'));
      set(link.querySelector('small'),usd?t('soon')+' · USD':'RUB');
    }
    for(const node of prices){
      const rub=selected==='RUB',amount=rub?node.dataset.neonPriceRub:t('soon'),unit=rub?'₽':'USD';
      node.dataset.noL10n='';
      if(node.textContent===amount+' '+unit)continue;
      const suffix=document.createElement('small');suffix.textContent=unit;
      node.replaceChildren(document.createTextNode(amount+' '),suffix);
    }
    set(picker.querySelector('[data-neon-currency-note]'),t(selected==='USD'?'usdNotice':'hint'));
  }
  picker.addEventListener('click',event=>{
    const link=event.target.closest('[data-neon-currency]');
    if(!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    event.preventDefault();
    if(currency()!==link.dataset.neonCurrency)history.pushState(null,'',url(link.dataset.neonCurrency));
    render();
  });
  addEventListener('raccoon:appchange',render);
  addEventListener('hanzi:languagechange',render);
  addEventListener('popstate',render);
  render();
})();
