/* One saved presentation language across the studio, app pages and checkout. */
(() => {
  'use strict';
  if(window.HanziLanguagePreference)return;
  const supported=['en','ru','es','pt','fr','de','ar','hi','id','ja','ko','tr'];
  const base=value=>String(value||'').trim().toLowerCase().split(/[-_]/u)[0];
  const valid=value=>{const code=base(value);return supported.includes(code)?code:null;};
  function saved(key){try{return valid(localStorage.getItem(key));}catch{return null;}}
  const legacy=saved('ral-language');
  let current=saved('hanzi-plus-language')||legacy;
  function device(){
    try{return valid(navigator.languages?.[0]||navigator.language)||'en';}catch{return 'en';}
  }
  function remember(value){
    const code=valid(value);if(!code)return null;
    current=code;
    try{localStorage.setItem('hanzi-plus-language',code);}catch{}
    // Old demos still need an English/Russian source before the shared translator.
    try{localStorage.setItem('ral-language',code==='ru'?'ru':'en');}catch{}
    return code;
  }
  function resolve(){
    const requested=valid(new URLSearchParams(location.search).get('lang'));
    // Keep device access lazy: a saved/manual choice never needs redetection.
    return remember(requested||current||device());
  }
  window.HanziLanguagePreference=Object.freeze({resolve,device,remember});
  window.HANZI_INITIAL_LOCALE={legacy,code:resolve()};
})();
