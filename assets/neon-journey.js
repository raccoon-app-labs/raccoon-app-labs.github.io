import {installComicPointer} from '/plus/comic-pointer.js?v=20261027-product';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
if(document.body.dataset.product==='neon'){
  installComicPointer({reducedMotion:()=>reduced.matches,finePointer:fine});
  const scene=document.querySelector('.neon-comic-scene'),headings=[...document.querySelectorAll('.section-heading')];
  let frame=0,closed=false;
  function draw(){frame=0;if(closed)return;if(scene){const r=scene.getBoundingClientRect();scene.style.setProperty('--neon-scene',reduced.matches?'0':Math.min(1,Math.max(0,-r.top/600)).toFixed(3));}for(const node of headings){const r=node.getBoundingClientRect();node.style.setProperty('--section-charge',reduced.matches?'1':Math.min(1,Math.max(0,(innerHeight-r.top)/280)).toFixed(3));}}
  function schedule(){if(!frame&&!closed)frame=requestAnimationFrame(draw);}
  const root=document.documentElement;
  function language(){const n=document.querySelector('.comic-sticker');if(n){n.dataset.noL10n='';n.textContent=root.lang==='ru'?'ТВОЙ ЗАБЕГ. ТВОИ ПРАВИЛА.':'YOUR RUN. YOUR RULES.';}}
  new MutationObserver(language).observe(root,{attributes:true,attributeFilter:['lang']});language();draw();
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);
  addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});addEventListener('pageshow',()=>{closed=false;schedule();});
}
