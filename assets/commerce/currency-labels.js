/* Presentation only. Payment providers, enabled states and API calls remain owned by checkout. */
(() => {
 const lang=()=>window.HanziLocale?.code || document.documentElement.lang || 'en';
 const t=key=>(window.HanziCurrencyCopy?.[lang()] || window.HanziCurrencyCopy?.en || {})[key] || key;
 const set=(node,value)=>{if(node && node.textContent!==value){node.dataset.noL10n='';node.textContent=value;}};
 let queued=false;
 function render(){
  queued=false;
  const emailForm=document.querySelector('#email-form');
  if(emailForm && !emailForm.hidden)set(document.querySelector('#step-description'),t('email'));
  const oldAccountLabels=new Set(['Russian account',...Object.values(window.HANZI_SITE_MESSAGES || window.HANZI_PLUS_MESSAGES || {}).map(messages=>messages['Russian account']).filter(Boolean)]);
  document.querySelectorAll('.eyebrow span,#availability').forEach(node=>{if(oldAccountLabels.has(node.textContent.trim()))set(node,'RUB · Robokassa');});
  document.querySelectorAll('[data-story-copy=payments]').forEach(node=>set(node,t('storyPayments')));
  document.querySelectorAll('.magic-providers').forEach(group=>{
   set(group.querySelector('legend'),t('method'));
   for(const provider of group.querySelectorAll('.magic-provider')){
    const input=provider.querySelector('input');if(!input)continue;
    set(provider.querySelector('small'),input.value==='robokassa'?'RUB · ₽':t('soon'));
    if(input.disabled)set(provider.querySelector('.magic-soon'),t('soon'));
   }
  });
 }
 const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(render);}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 addEventListener('hanzi:languagechange',render);render();
})();
