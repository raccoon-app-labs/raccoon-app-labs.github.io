/* Decorative only. No network, payment state, storage or interactive overlay. */
(() => {
  'use strict';
  function mount() {
    const root=document.documentElement;
    if(!root.dataset.paymentAtmosphere || document.querySelector('.payment-atmosphere'))return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
    const layer=document.createElement('div');layer.className='payment-atmosphere';
    layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');layer.dataset.noL10n='';
    layer.dataset.context=root.dataset.atmosphereContext || 'shop';
    const depth=document.createElement('div');depth.className='atmosphere-depth';
    const namespace='http://www.w3.org/2000/svg';
    function svg(paths,viewBox='0 0 48 48'){
      const drawing=document.createElementNS(namespace,'svg');drawing.setAttribute('viewBox',viewBox);drawing.setAttribute('fill','none');
      for(const d of paths){const path=document.createElementNS(namespace,'path');path.setAttribute('d',d);drawing.append(path);}
      return drawing;
    }
    for(let i=0;i<3;i++){const wash=document.createElement('span');wash.className='atmosphere-wash wash-'+i;depth.append(wash);}
    const ribbons=document.createElement('div');ribbons.className='atmosphere-ribbons';
    for(let i=0;i<3;i++){
      const ribbon=document.createElement('div');ribbon.className='atmosphere-ribbon ribbon-'+i;
      ribbon.append(svg(['M-80 400C100-140 340 720 600 200S1000 0 1200 400','M-80 415C100-125 340 735 600 215S1000 15 1200 415'],'0 0 1120 600'));
      ribbons.append(ribbon);
    }
    depth.append(ribbons);
    const paths={
      spark:['M24 5 28 19 43 24 28 29 24 43 19 29 5 24 19 19Z'],
      key:['M20 24a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM20 24h23M34 24v8M41 24v6'],
      petal:['M8 38C-1 20 19 5 39 6 39 29 29 47 8 38ZM8 38 31 15'],
      moon:['M35 6a18 18 0 1 0 7 28A19 19 0 0 1 35 6Z'],
      ticket:['M5 10h38v10a4 4 0 0 0 0 8v10H5V28a4 4 0 0 0 0-8ZM30 10v5m0 4v4m0 4v4m0 4v3'],
      letter:['M5 13h38v25H5ZM5 13l19 14 19-14M5 38l13-14m25 14L30 24'],
      paw:['M16 26c-12 9-8 18 2 14 5-3 7-3 12 0 10 4 14-5 2-14-6-6-10-6-16 0ZM12 14a4 6 0 1 0 0 .1M22 7a4 6 0 1 0 0 .1M33 11a4 6 0 1 0 0 .1M40 20a3 5 0 1 0 0 .1'],
      leaf:['M6 36C8 11 26 4 43 6 42 27 31 43 6 36ZM6 36 35 14M18 25v-9m5 4 10 1'],
      bowl:['M5 25h38c-1 12-8 17-19 17S6 37 5 25ZM19 19c-8-8 7-6 0-14M30 19c-8-8 7-6 0-14'],
      box:['M5 16 24 6l19 10v24L24 47 5 37ZM5 16l19 10 19-10M24 26v21M15 11l19 10v10'],
      bolt:['M29 3 7 28h15l-4 17 23-27H26Z']
    };
    const tokens=[];
    for(let i=0;i<12;i++){const token=document.createElement('span');token.className='atmosphere-token token-'+i;tokens.push(token);depth.append(token);}
    const constellation=svg(['M3 35 19 17 38 25 56 7 79 18 96 4','M19 17 27 47 50 57 63 40 79 18'],'0 0 100 65');
    constellation.classList.add('atmosphere-constellation');depth.append(constellation);
    for(let i=0;i<3;i++){const comet=document.createElement('span');comet.className='atmosphere-comet comet-'+i;depth.append(comet);}
    layer.append(depth);document.body.prepend(layer);
    const worlds={bloom:['petal','spark','letter'],keys:['key','moon','spark'],stories:['spark','letter','moon'],muropolis:['paw','spark','leaf'],food:['leaf','bowl','ticket'],dokupit:['box','ticket','spark'],neon:['bolt','spark','moon']};
    let currentWorld,frame=0,point={x:0,y:0},closed=false;
    function sync(){
      const world=root.dataset.paymentAtmosphere==='hanzi'?(root.dataset.app==='keys'?'keys':'bloom'):root.dataset.paymentAtmosphere;
      if(world!==currentWorld){currentWorld=world;layer.dataset.world=world;tokens.forEach((token,i)=>token.replaceChildren(svg(paths[(worlds[world] || worlds.bloom)[i%3]])));}
      const isReduced=reduced.matches || root.dataset.motion==='reduced' || navigator.connection?.saveData===true;
      layer.dataset.reduced=String(isReduced);
      const typing=document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
      const paused=closed || document.hidden || isReduced || typing;
      const held=paused && !isReduced?getComputedStyle(depth).transform:'';
      layer.dataset.paused=String(paused);
      if(paused){cancelAnimationFrame(frame);frame=0;depth.style.transform=held;}
    }
    function draw(){frame=0;if(layer.dataset.paused==='true')return;depth.style.transform=`translate3d(${point.x}px,${point.y-Math.min(scrollY,1500)*.018}px,0)`;}
    function schedule(){if(!frame && layer.dataset.paused!=='true')frame=requestAnimationFrame(draw);}
    document.addEventListener('pointermove',event=>{
      if(!fine.matches || event.pointerType==='touch' || layer.dataset.paused==='true')return;
      point={x:(event.clientX/innerWidth-.5)*14,y:(event.clientY/innerHeight-.5)*12};schedule();
    },{passive:true});
    document.documentElement.addEventListener('pointerleave',()=>{point={x:0,y:0};schedule();});
    window.addEventListener('scroll',schedule,{passive:true});
    document.addEventListener('visibilitychange',sync);
    document.addEventListener('focusin',sync);document.addEventListener('focusout',()=>queueMicrotask(sync));
    reduced.addEventListener('change',sync);
    new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-app','data-motion']});
    window.addEventListener('pagehide',()=>{closed=true;sync();});
    window.addEventListener('pageshow',()=>{closed=false;sync();});sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
