/* Share scroll activity; pause decorative work without delaying native scrolling. */
(() => {
  'use strict';
  const root=document.documentElement;
  if(root.dataset.motionRuntime)return;
  root.dataset.motionRuntime='ready';
  let timer=0,closed=false;
  function notify(){window.dispatchEvent(new Event('raccoon:scrollstate'));}
  function settle(){
    clearTimeout(timer);timer=0;
    if(!root.dataset.siteScrolling)return;
    delete root.dataset.siteScrolling;notify();
  }
  function scrolling(){
    if(closed || document.hidden)return;
    if(!root.dataset.siteScrolling){root.dataset.siteScrolling='true';notify();}
    clearTimeout(timer);timer=setTimeout(settle,150);
  }
  document.addEventListener('scroll',scrolling,{capture:true,passive:true});
  document.addEventListener('scrollend',settle,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settle();});
  window.addEventListener('pagehide',()=>{closed=true;settle();});
  window.addEventListener('pageshow',()=>{closed=false;settle();});
  if(typeof IntersectionObserver==='function'){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){const value=entry.isIntersecting?'visible':'offscreen';if(entry.target.dataset.motionVisibility!==value)entry.target.dataset.motionVisibility=value;}
    },{rootMargin:'140px 0px'});
    for(const host of document.querySelectorAll('.visual,.hero-scene,.commerce-scene,.app-card,.character-card,.hero-art,.native-app'))observer.observe(host);
  }
})();
