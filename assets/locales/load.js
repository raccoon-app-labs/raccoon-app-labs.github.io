/* Only the chosen extra language is transferred; failures remain retryable. */
(() => {
  'use strict';
  const packs=window.HANZI_LOCALE_PACKS;
  if(!packs)return;
  const ready=new Set(packs.initial),pending=new Map();
  window.HanziLanguageLoader=Object.freeze({
    ready:code=>ready.has(code),
    load(code){
      if(ready.has(code))return Promise.resolve();
      if(pending.has(code))return pending.get(code);
      const spec=packs.languages[code];
      if(!spec)return Promise.reject(new Error('Unsupported language'));
      const promise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=spec.src;script.integrity=spec.integrity;
        script.async=true;script.onload=()=>{ready.add(code);script.remove();resolve();};
        script.onerror=()=>{pending.delete(code);script.remove();reject(new Error('Language unavailable'));};
        document.head.append(script);
      });
      pending.set(code,promise);return promise;
    }
  });
})();
