const root=document.documentElement,switcher=document.querySelector('.language-switch');
function setLanguage(lang){root.lang=lang;document.querySelectorAll('[data-ru][data-en]').forEach(el=>{el.textContent=el.dataset[lang]});document.querySelectorAll('[data-alt-ru][data-alt-en]').forEach(el=>{el.alt=el.dataset[lang==='ru'?'altRu':'altEn']});switcher.style.setProperty('--side',lang==='ru'?0:1);switcher.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',button.dataset.lang===lang?'true':'false'));localStorage.setItem('ral-language',lang)}
switcher.addEventListener('click',event=>{const button=event.target.closest('[data-lang]');if(button)setLanguage(button.dataset.lang)});
setLanguage(localStorage.getItem('ral-language')||'ru');
