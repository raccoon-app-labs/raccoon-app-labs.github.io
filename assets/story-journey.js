(() => {
  'use strict';
  if(document.body.dataset.product!=='stories')return;
  const root=document.documentElement,header=document.querySelector('.site-header'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const chapters=[...document.querySelectorAll('main>.experience,main>.benefits,main>.screens,main>.faq-section')];
  chapters.forEach((node,i)=>{node.classList.add('story-chapter');node.dataset.chapter=String(i+1).padStart(2,'0')+' /';});
  const cards=[...document.querySelectorAll('.benefit-card')];cards.forEach((n,i)=>n.style.setProperty('--chapter-index',i));
  const unfold=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-unfolded');unfold.unobserve(e.target);}},{threshold:.16});cards.forEach(n=>unfold.observe(n));
  let frame=0,closed=false;
  function draw(){frame=0;if(closed)return;for(const node of chapters){const r=node.getBoundingClientRect();const p=reduced.matches?1:Math.min(1,Math.max(0,(innerHeight-r.top)/Math.min(innerHeight*.7,500)));node.style.setProperty('--chapter-reveal',p.toFixed(3));}}
  function schedule(){if(!frame&&!closed)frame=requestAnimationFrame(draw);}
  function headerSize(){root.style.setProperty('--story-header',(header?.offsetHeight||80)+'px');schedule();}
  if(header)new ResizeObserver(headerSize).observe(header);
  function language(){
    const ru=root.lang==='ru';
    const copy={'.book-hint-motion':ru?'Вниз — раскрыть · вверх — закрыть':'Scroll down to open · up to close','.book-hint-still':ru?'Загляни внутрь истории':'A little peek inside the story','.story-scroll-stage .scene-tag':ru?'У каждой сказки есть свой свет':'Every story has its own light'};
    for(const [selector,value] of Object.entries(copy)){const n=document.querySelector(selector);if(n){n.dataset.noL10n='';n.textContent=value;}}
    schedule();
  }
  new MutationObserver(language).observe(root,{attributes:true,attributeFilter:['lang']});language();headerSize();
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',headerSize,{passive:true});reduced.addEventListener('change',schedule);
  addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});addEventListener('pageshow',()=>{closed=false;schedule();});
})();
