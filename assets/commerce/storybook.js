/* Native scrolling opens real 3D leaves; reversing the scroll closes them. */
(() => {
  'use strict';
  const track=document.querySelector('[data-story-scroll]');if(!track)return;
  const stage=track.querySelector('.story-scroll-stage'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced=()=>reduced.matches || document.documentElement.dataset.motion==='reduced';
  let start=0,range=1,frame=0,active=true,closed=false,last=-1;
  const clamp=value=>Math.min(1,Math.max(0,value));
  const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
  function draw(){
    frame=0;if(closed || document.hidden)return;
    if(track.closest('[hidden]') && document.documentElement.dataset.app!=='stories')return;
    const p=isReduced()?1:clamp((scrollY-start)/range);
    if(Math.abs(p-last)<.0002)return;last=p;
    stage.style.setProperty('--book-open',ease(p).toFixed(5));
    stage.style.setProperty('--cover-turn',ease(p/.66).toFixed(5));
    stage.style.setProperty('--leaf-one',ease((p-.22)/.67).toFixed(5));
    stage.style.setProperty('--leaf-two',ease((p-.4)/.6).toFixed(5));
    stage.style.setProperty('--world-reveal',ease((p-.4)/.6).toFixed(5));
    stage.dataset.bookProgress=p.toFixed(4);
  }
  function schedule(){if(!frame && active && !closed && !document.hidden)frame=requestAnimationFrame(draw);}
  function measure(){
    track.dataset.bookReduced=String(isReduced());
    const stickyTop=parseFloat(getComputedStyle(stage).top)||0;
    // An entering tab can be visually translated without moving its layout.
    // Using its bounding rect would retain that temporary animation offset.
    let layoutTop=0;for(let node=track;node;node=node.offsetParent)layoutTop+=node.offsetTop;
    start=layoutTop-stickyTop;
    range=Math.max(1,track.offsetHeight-stage.offsetHeight);last=-1;draw();
  }
  track.dataset.scrollReady='true';measure();
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',measure,{passive:true});
  const resize=new ResizeObserver(measure);resize.observe(track);resize.observe(stage);resize.observe(document.querySelector('.commerce-header') || document.querySelector('.topbar'));
  const tabs=document.querySelector('.app-nav');if(tabs)resize.observe(tabs);
  const visibility=new IntersectionObserver(entries=>{active=entries[0].isIntersecting;if(active)schedule();},{rootMargin:'120px'});visibility.observe(track);
  reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;measure();});
  new MutationObserver(measure).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  window.addEventListener('raccoon:appchange',measure);
  document.fonts?.ready.then(measure);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else measure();});
  window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});
  window.addEventListener('pageshow',()=>{closed=false;measure();});
})();
