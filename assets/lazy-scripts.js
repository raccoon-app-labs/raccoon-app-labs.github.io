/* Demos start near their section; the header, artwork and navigation stay independent. */
(() => {
  'use strict';
  const groups=new Map();
  for(const placeholder of document.querySelectorAll('script[data-lazy-src]')){
    const target=document.querySelector(placeholder.dataset.lazyTarget);
    if(!target)continue;
    if(!groups.has(target))groups.set(target,{target,jobs:[],running:false,retry:null});
    groups.get(target).jobs.push({placeholder,loaded:false});
  }
  async function load(group){
    if(group.running)return;group.running=true;group.target.dataset.demoState='loading';
    group.retry?.remove();group.retry=null;
    try{
      for(const job of group.jobs){
        if(job.loaded)continue;
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          for(const name of ['type','integrity','crossorigin','referrerpolicy']){
            const value=job.placeholder.getAttribute(name);if(value)script.setAttribute(name,value);
          }
          script.async=false;script.fetchPriority='low';script.src=job.placeholder.dataset.lazySrc;
          script.onload=()=>{job.loaded=true;resolve();};script.onerror=()=>{script.remove();reject(new Error('Demo unavailable'));};
          job.placeholder.after(script);
        });
      }
      group.target.dataset.demoState='ready';
    }catch{
      group.target.dataset.demoState='error';
      const retry=document.createElement('button');retry.type='button';retry.className='demo-button demo-retry';retry.dataset.noL10n='';
      retry.textContent=document.documentElement.lang==='ru'?'Загрузить демо ещё раз':'Retry demo';
      retry.addEventListener('click',()=>load(group));group.target.querySelector('.interactive-demo')?.append(retry);group.retry=retry;
    }finally{group.running=false;}
  }
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);load(groups.get(entry.target));}
  },{rootMargin:'450px 0px'}):null;
  for(const group of groups.values())if(observer)observer.observe(group.target);else load(group);
})();
