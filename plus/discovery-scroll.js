/* Three reversible illustrations: unfold, listen/build, then light the path. */
(() => {
  'use strict';
  const section=document.getElementById('included');if(!section || section.dataset.discoveryReady)return;
  const cards=[...section.querySelectorAll('.feature')];if(cards.length!==3)return;
  const root=document.documentElement,grid=section.querySelector('.feature-grid');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const reduced=()=>motion.matches || root.dataset.motion==='reduced';
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{const x=clamp(n);return x*x*(3-2*x);};
  const pictures=cards.map(card=>card.querySelector('.feature-picture'));
  const paper=document.createElement('div');paper.className='discovery-fold';paper.setAttribute('aria-hidden','true');
  pictures[0].prepend(paper);
  const ink=document.createElement('i');ink.className='discovery-ink';pictures[0].append(ink);
  const ripple=document.createElement('div');ripple.className='discovery-ripples';ripple.setAttribute('aria-hidden','true');
  ripple.innerHTML='<svg viewBox="0 0 300 130" preserveAspectRatio="none" focusable="false"><ellipse cx="150" cy="51" rx="74" ry="25"/><ellipse cx="150" cy="51" rx="111" ry="39"/><path pathLength="1" d="M22 62C54 62 58 26 83 31S114 81 141 63S167 20 193 39S222 73 278 42"/></svg>';
  pictures[1].prepend(ripple);
  const route=document.createElement('div');route.className='discovery-route';
  for(const node of [...pictures[2].children])if(node.matches('.progress-dot,.progress-line,.progress-flower'))route.append(node);
  pictures[2].prepend(route);
  route.querySelectorAll('.progress-dot').forEach((node,i)=>node.classList.add('discovery-stop-'+i));
  route.querySelectorAll('.progress-line').forEach((node,i)=>node.classList.add('discovery-link-'+i));
  const burst=document.createElementNS('http://www.w3.org/2000/svg','svg');burst.classList.add('discovery-burst');burst.setAttribute('viewBox','0 0 100 100');burst.setAttribute('aria-hidden','true');burst.setAttribute('focusable','false');
  burst.innerHTML='<circle cx="50" cy="50" r="32" pathLength="1"/>'+Array.from({length:8},(_,i)=>'<path d="M50 7v10" transform="rotate('+(i*45)+' 50 50)"/>').join('');
  route.querySelector('.progress-flower').append(burst);
  cards.forEach(card=>card.classList.add('is-visible'));
  section.classList.add('has-discovery-motion');section.dataset.discoveryReady='true';
  let ranges=[],frame=0,visible=true,closed=false,last=[];
  function available(){return ['bloom','keys'].includes(root.dataset.app) && !section.closest('[hidden]') && section.offsetWidth>0;}
  function draw(){
    frame=0;if(closed || document.hidden || !ranges.length)return;
    const active=available(),still=reduced();
    for(const [index,picture] of pictures.entries()){
      const p=still?1:active?clamp((scrollY-ranges[index].start)/ranges[index].range):0;
      if(Math.abs(p-(last[index]??-1))<.0001)continue;last[index]=p;
      picture.dataset.discoveryProgress=p.toFixed(4);
      picture.style.setProperty('--discover-open',ease(p).toFixed(5));
      picture.style.setProperty('--discover-stroke',ease(p/.76).toFixed(5));
      picture.style.setProperty('--discover-step-0',ease(p/.32).toFixed(5));
      picture.style.setProperty('--discover-link-0',ease((p-.12)/.35).toFixed(5));
      picture.style.setProperty('--discover-step-1',ease((p-.36)/.27).toFixed(5));
      picture.style.setProperty('--discover-link-1',ease((p-.5)/.32).toFixed(5));
      picture.style.setProperty('--discover-flower',ease((p-.62)/.38).toFixed(5));
      if(index===1)picture.querySelectorAll('.sound-bars i').forEach((bar,i)=>bar.style.setProperty('--discover-wave',still?'1':(.2+ease(p/.45)*(.35+.75*Math.abs(Math.sin(p*Math.PI*2.6+i*.8)))).toFixed(4)));
    }
    const first=ranges[0].start,end=ranges[2].start+ranges[2].range;
    grid.style.setProperty('--discover-journey',(still?1:active?clamp((scrollY-first)/Math.max(1,end-first)):0).toFixed(5));
    section.dataset.discoveryReduced=String(still);
  }
  function schedule(){if(!frame && visible && !closed && !document.hidden && !reduced())frame=requestAnimationFrame(draw);}
  function measure(){
    const nav=document.querySelector('.app-nav')?.offsetHeight||0;
    ranges=pictures.map((picture,index)=>{
      let top=0;for(let node=picture;node;node=node.offsetParent)top+=node.offsetTop;
      const finishTop=Math.max(Math.min(nav+18,Math.max(8,innerHeight-picture.offsetHeight-8)),Math.min(innerHeight*.32,innerHeight-picture.offsetHeight-16));
      const start=Math.max(0,top-innerHeight*.9+(innerWidth>520?index*22:0));
      const range=Math.max(80,top-finishTop-start);
      picture.dataset.discoveryStart=start.toFixed(2);picture.dataset.discoveryRange=range.toFixed(2);
      return {start,range};
    });last=[];draw();
  }
  function refresh(){cancelAnimationFrame(frame);frame=0;measure();}
  measure();
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure,{passive:true});
  const sizes=new ResizeObserver(measure);sizes.observe(section);sizes.observe(grid);
  pictures.forEach(p=>sizes.observe(p));for(const node of document.querySelectorAll('.app-nav,.topbar'))sizes.observe(node);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=[];draw();}else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'150px'}).observe(section);
  new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-app','data-account-region','data-motion']});
  motion.addEventListener('change',refresh);addEventListener('raccoon:appchange',refresh);addEventListener('hanzi:languagechange',measure);
  document.fonts?.ready.then(measure);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else measure();});
  addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});addEventListener('pageshow',()=>{closed=false;measure();});
})();
