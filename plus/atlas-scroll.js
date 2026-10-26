/* A reversible constellation drawn by native scrolling, without a scroll trap. */
(() => {
  'use strict';
  const scene=document.getElementById('scene');if(!scene || scene.dataset.atlasReady)return;
  const root=document.documentElement,hero=scene.closest('.hero');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const reduced=()=>motion.matches || root.dataset.motion==='reduced';
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{const v=clamp(n);return v*v*(3-2*v);};
  let frame=0,start=0,range=1,visible=true,closed=false,last=-1;
  const orbit=document.createElement('div');orbit.className='atlas-orbits';orbit.setAttribute('aria-hidden','true');
  orbit.innerHTML='<svg viewBox="0 0 600 500" focusable="false"><defs><linearGradient id="atlas-ink"><stop stop-color="currentColor"/><stop offset=".5" stop-color="currentColor" stop-opacity=".15"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs><ellipse class="atlas-halo" cx="322" cy="272" rx="225" ry="166"/><path class="atlas-ribbon ribbon-first" pathLength="1" d="M367 382C509 398 591 224 471 113C352 3 108 101 110 272C112 392 370 427 478 284"/><path class="atlas-ribbon ribbon-second" pathLength="1" d="M357 386C183 407 23 252 132 146C254 27 523 159 496 322C482 405 283 443 207 326"/></svg><i class="atlas-paper paper-one"></i><i class="atlas-paper paper-two"></i>';
  const sky=document.createElement('div');sky.className='atlas-sky';sky.setAttribute('aria-hidden','true');sky.lang='zh-Hans';
  const glyphs=[];
  for(let i=0;i<5;i++){
    const glyph=document.createElement('span');glyph.className='atlas-glyph glyph-'+i;glyphs.push(glyph);sky.append(glyph);
  }
  for(let i=0;i<7;i++){const spark=document.createElement('i');spark.className='atlas-spark spark-'+i;sky.append(spark);}
  const key=document.createElement('span');key.className='atlas-key';key.innerHTML='<svg viewBox="0 0 64 40" focusable="false"><circle cx="18" cy="20" r="10"/><path d="M28 20h27m-7 0v9m-10-9v6"/></svg>';sky.append(key);
  scene.append(orbit,sky);scene.classList.add('has-atlas-scroll');scene.dataset.atlasReady='true';
  function words(){
    const letters=root.dataset.app==='keys'?['日','月','明','木','林']:['你','好','朋','友','学'];
    glyphs.forEach((node,i)=>{node.textContent=letters[i];});
  }
  function available(){return ['bloom','keys'].includes(root.dataset.app) && !scene.closest('[hidden]') && scene.offsetWidth>0;}
  function draw(){
    frame=0;if(closed || document.hidden)return;
    const enabled=available()&&!reduced();
    const p=enabled?clamp((scrollY-start)/range):0;
    if(Math.abs(p-last)<.0001)return;last=p;
    scene.style.setProperty('--atlas-open',ease(p).toFixed(5));
    scene.style.setProperty('--atlas-bloom',ease((p-.12)/.88).toFixed(5));
    scene.style.setProperty('--atlas-lift',(-16*ease(p)).toFixed(3)+'px');
    scene.style.setProperty('--atlas-ticket-y',(-12*ease(p)).toFixed(3)+'px');
    scene.dataset.atlasProgress=p.toFixed(4);
    scene.dataset.atlasReduced=String(reduced());
  }
  function schedule(){if(!frame && visible && !closed && !document.hidden && !reduced())frame=requestAnimationFrame(draw);}
  function measure(){
    let top=0;for(let node=scene;node;node=node.offsetParent)top+=node.offsetTop;
    const nav=document.querySelector('.app-nav')?.offsetHeight||0;
    start=Math.max(0,top-innerHeight*.62);
    range=Math.max(180,top-nav+scene.offsetHeight*.16-start);
    scene.dataset.atlasStart=start.toFixed(2);scene.dataset.atlasRange=range.toFixed(2);
    last=-1;draw();
  }
  function refresh(){cancelAnimationFrame(frame);frame=0;words();measure();}
  words();measure();
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure,{passive:true});
  new ResizeObserver(measure).observe(hero);
  const sizes=new ResizeObserver(measure);sizes.observe(scene);
  for(const node of document.querySelectorAll('.app-nav,.topbar,[data-commerce-region]'))sizes.observe(node);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=-1;draw();}else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'120px'}).observe(scene);
  new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-motion','data-app','data-account-region']});
  motion.addEventListener('change',refresh);addEventListener('raccoon:appchange',refresh);addEventListener('hanzi:languagechange',measure);
  document.fonts?.ready.then(measure);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else measure();});
  addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',()=>{closed=false;measure();});
})();
