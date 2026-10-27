/* Prioritize nearby slides, bound concurrent transfers and reveal decoded frames. */
(() => {
  'use strict';
  const queue=[],limit=2;let active=0;
  function drain(){
    while(active<limit && queue.length){
      queue.sort((a,b)=>{const distance=job=>{const r=job.image.getBoundingClientRect();return Math.abs(r.top+r.height/2-window.innerHeight/2)+Math.max(0,r.left-window.innerWidth,r.right<0?-r.right:0);};return distance(a)-distance(b);});
      const job=queue.shift();active++;job.start(()=>{active--;drain();});
    }
  }
  const retryWords={ru:'Не загрузилось · Повторить',en:'Retry image'};
  // Painted hero art keeps its complete inline preview while sharpening offscreen.
  for(const image of document.querySelectorAll('img[data-display-src]')){
    queue.push({image,start(finish){
      const next=new Image();next.decoding='async';next.fetchPriority='high';
      next.onload=async()=>{try{await next.decode();image.src=next.src;}catch{}finish();};
      next.onerror=finish;next.src=image.dataset.displaySrc;
    }});
  }
  drain();
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){entry.target._loadScreenshot();observer.unobserve(entry.target);}
  },{rootMargin:'600px 200px'}):null;
  for(const image of document.querySelectorAll('img[data-store-screen]')){
    const figure=image.closest('figure');
    const source=image.dataset.screenSrc || image.getAttribute('src');
    let retry,done,decoding=false,attempt=0;
    function release(){const finish=done;done=null;finish?.();}
    async function loaded(){
      if(image.dataset.imageState!=='loading' || !image.naturalWidth || decoding)return;
      decoding=true;
      try{await image.decode();}catch{decoding=false;failed();return;}
      decoding=false;image.dataset.imageState='ready';retry?.remove();retry=undefined;release();
    }
    function failed(){
      if(image.dataset.imageState!=='loading')return;
      image.dataset.imageState='error';release();
      if(!figure || retry)return;
      retry=document.createElement('button');retry.type='button';retry.className='screenshot-retry';
      retry.dataset.noL10n='';retry.textContent=retryWords[document.documentElement.lang] || retryWords.en;
      retry.addEventListener('click',()=>{retry.remove();retry=undefined;enqueue(true);});figure.append(retry);
    }
    function enqueue(again=false){
      if(!again && image.dataset.imageState!=='waiting')return;
      image.dataset.imageState='queued';
      queue.push({image,start(finish){
        done=finish;image.dataset.imageState='loading';image.loading='eager';image.fetchPriority='low';
        image.src=source+(again?(source.includes('?')?'&':'?')+'retry='+(++attempt):'');
        if(image.complete && image.naturalWidth)loaded();
      }});drain();
    }
    image.addEventListener('load',loaded);image.addEventListener('error',failed);
    if(image.dataset.screenSrc){
      image.dataset.imageState='waiting';image._loadScreenshot=enqueue;
      if(observer)observer.observe(image);else enqueue();
    }else{
      image.dataset.imageState='loading';
      if(image.complete){if(image.naturalWidth)loaded();else failed();}
    }
  }
})();
