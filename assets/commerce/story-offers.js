/* Scroll is the timeline. Decoration never changes a price, link or access. */
(() => {
  'use strict';
  const grid=document.querySelector('.commerce-stories .offer-grid');
  if(!grid)return;
  const cards=[...grid.querySelectorAll('.offer-card')];
  const root=document.documentElement,media=matchMedia('(prefers-reduced-motion: reduce)');
  const panel=grid.closest('[role=tabpanel]');
  let frame=0,metrics=[];
  const reduced=()=>media.matches || root.dataset.motion==='reduced';
  for(const [index,card] of cards.entries()){
    const magic=document.createElement('div');magic.className='offer-magic';magic.setAttribute('aria-hidden','true');magic.setAttribute('inert','');
    magic.innerHTML='<span class="offer-magic-edge"></span><span class="offer-magic-sheen"></span><svg class="offer-constellation" viewBox="0 0 600 200" fill="none" preserveAspectRatio="none"><path pathLength="100" d="M40 150C140 25 235 190 330 90S470 125 570 35"/><circle cx="40" cy="150" r="3"/><circle cx="330" cy="90" r="4"/><circle cx="570" cy="35" r="3"/></svg>';
    for(let i=0;i<7;i++){
      const star=document.createElement('i');star.className='offer-magic-star';
      star.style.setProperty('--star-index',i);magic.append(star);
    }
    card.style.setProperty('--ticket-side',index%2?1:-1);
    card.prepend(magic);
  }
  function draw(){
    frame=0;
    if(document.hidden || panel?.hidden)return;
    const still=reduced();grid.dataset.offerMotion=still?'reduced':'scroll';
    for(const item of metrics){
      const p=still ? .5 : Math.max(0,Math.min(1,(scrollY+innerHeight-item.top)/(innerHeight+item.height)));
      const value=p.toFixed(4);
      if(item.card.dataset.offerProgress===value && item.still===still)continue;
      item.still=still;item.card.dataset.offerProgress=value;
      item.card.style.setProperty('--offer-progress',value);
      item.card.style.setProperty('--offer-glow',Math.sin(p*Math.PI).toFixed(4));
    }
  }
  function schedule(){if(!frame && !document.hidden)frame=requestAnimationFrame(draw);}
  function measure(){
    if(panel?.hidden)return;
    metrics=cards.map(card=>{
      // Visual transforms must not feed back into the next layout measurement.
      let top=0;for(let node=card;node;node=node.offsetParent)top+=node.offsetTop;
      return{card,top,height:card.offsetHeight};
    });schedule();
  }
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);
  addEventListener('raccoon:appchange',measure);addEventListener('hanzi:languagechange',measure);
  addEventListener('pageshow',measure);media.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else measure();});
  new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-motion']});
  const observer=new ResizeObserver(measure);observer.observe(grid);cards.forEach(card=>observer.observe(card));
  document.fonts.ready.then(measure);measure();
})();
