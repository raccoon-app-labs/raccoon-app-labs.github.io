/* Tiny previews only: animation never activates access or spends game currency. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const timers=new Map();
  const app=new URLSearchParams(location.search).get('app');
  if(app==='keys'||app==='bloom')for(const link of document.querySelectorAll('[data-russian-catalog],[data-international-catalog]')){
    const target=new URL(link.href);target.searchParams.set('app',app);link.href=target.href;
  }
  for(const scene of document.querySelectorAll('.commerce-scene')){
    const button=scene.querySelector('.scene-play');
    button?.addEventListener('click',()=>{
      clearTimeout(timers.get(scene));scene.classList.remove('is-alive');
      if(!reduced.matches){void scene.offsetWidth;scene.classList.add('is-alive');timers.set(scene,setTimeout(()=>{scene.classList.remove('is-alive');timers.delete(scene);},1600));}
    });
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){for(const [scene,timer] of timers){clearTimeout(timer);scene.classList.remove('is-alive');}timers.clear();}
  });
  window.addEventListener('pagehide',()=>{for(const timer of timers.values())clearTimeout(timer);timers.clear();});
})();
