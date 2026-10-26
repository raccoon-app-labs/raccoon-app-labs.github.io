/* Each hero has a reversible universe. Scroll is the only clock. */
(() => {
 'use strict';
 const section=document.querySelector('#neon-panel #bundles') || document.querySelector('main #bundles');
 if(!section || section.dataset.bundleMotionReady)return;
 const stages=[...section.querySelectorAll('.character-stage')];if(stages.length!==2)return;
 const root=document.documentElement,panel=section.closest('#neon-panel'),media=matchMedia('(prefers-reduced-motion: reduce)');
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{const p=clamp(x);return p*p*(3-2*p);};
 const still=()=>media.matches || root.dataset.motion==='reduced';
 for(const [index,stage] of stages.entries()){
  const fx=document.createElement('div');fx.className='bundle-universe '+(index?'eclipse-universe':'rift-universe');fx.setAttribute('aria-hidden','true');
  const sun='<circle class="eclipse-outline" cx="260" cy="178" r="129" pathLength="1"/><g class="eclipse-orbits"><ellipse cx="260" cy="178" rx="197" ry="65" pathLength="1"/><ellipse cx="260" cy="178" rx="166" ry="109" pathLength="1" transform="rotate(-36 260 178)"/><circle class="orbit-moon" cx="457" cy="178" r="7"/></g><g class="eclipse-rays">'+Array.from({length:16},(_,i)=>'<path d="M260 27v14" transform="rotate('+(i*22.5)+' 260 178)"/>').join('')+'</g>';
  const rift='<path class="rift-shadow" d="M105 350L209 265L190 201L290 108L306 12"/><path class="rift-stitch" pathLength="1" d="M105 350L209 265L190 201L290 108L306 12"/><g class="rift-debris">'+['126,94 165,83 150,132','329,85 366,118 328,131','90,210 136,189 119,236','349,191 394,211 354,236','149,291 180,317 139,331','300,273 337,285 313,322'].map((points,i)=>'<polygon class="rift-chip chip-'+i+'" points="'+points+'"/>').join('')+'</g><path class="rift-orbit" pathLength="1" d="M74 276C13 129 142 25 288 57S494 218 409 296S156 359 112 247"/>';
  fx.innerHTML='<svg viewBox="0 0 520 360" focusable="false">'+(index?sun:rift)+'</svg>';stage.prepend(fx);
  stage.classList.add('has-bundle-motion');
 }
 section.dataset.bundleMotionReady='true';
 let ranges=[],last=[],frame=0,visible=true,closed=false;
 function draw(){
  frame=0;if(closed || document.hidden || !ranges.length)return;
  const active=!panel || !panel.hidden;
  stages.forEach((stage,i)=>{
   const p=still()?1:active?clamp((scrollY-ranges[i].start)/ranges[i].range):0;
   if(Math.abs(p-(last[i]??-1))<.0001)return;last[i]=p;
   stage.dataset.bundleProgress=p.toFixed(4);
   stage.style.setProperty('--universe-open',ease(p).toFixed(5));
   stage.style.setProperty('--universe-ink',ease(p/.8).toFixed(5));
   stage.style.setProperty('--universe-burst',ease((p-.22)/.78).toFixed(5));
  });section.dataset.bundleMotionReduced=String(still());
 }
 function schedule(){if(!frame && visible && !closed && !document.hidden && !still())frame=requestAnimationFrame(draw);}
 function measure(){
  const nav=document.querySelector('.app-nav')?.offsetHeight||0;
  ranges=stages.map(stage=>{
   let top=0;for(let node=stage;node;node=node.offsetParent)top+=node.offsetTop;
   const finish=Math.max(Math.min(nav+18,Math.max(8,innerHeight-stage.offsetHeight-8)),Math.min(innerHeight*.26,innerHeight-stage.offsetHeight-16));
   const start=Math.max(0,top-innerHeight*.92),range=Math.max(100,top-finish-start);
   stage.dataset.bundleStart=start.toFixed(2);stage.dataset.bundleRange=range.toFixed(2);return {start,range};
  });last=[];draw();
 }
 measure();
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure,{passive:true});
 const size=new ResizeObserver(measure);size.observe(section);stages.forEach(stage=>size.observe(stage));
 for(const node of document.querySelectorAll('.app-nav,.topbar'))size.observe(node);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=[];draw();}else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'200px'}).observe(section);
 const refresh=()=>{cancelAnimationFrame(frame);frame=0;measure();};
 new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-app','data-motion','data-account-region']});
 media.addEventListener('change',refresh);addEventListener('raccoon:appchange',refresh);addEventListener('hanzi:languagechange',measure);document.fonts?.ready.then(measure);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else measure();});
 addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});addEventListener('pageshow',()=>{closed=false;measure();});
})();
