/* Scroll reveals the tickets; the pointer gently tilts their whole paper surface. */
(() => {
  'use strict';
  const grid=document.querySelector('.commerce-stories .offer-grid');
  if(!grid)return;
  const cards=[...grid.querySelectorAll('.offer-card')];
  const root=document.documentElement,media=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const panel=grid.closest('[role=tabpanel]');
  let frame=0,metrics=[],lastTime=0,pointer=null,closed=false;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const reduced=()=>media.matches || root.dataset.motion==='reduced';
  const active=()=>!closed && !document.hidden && !panel?.hidden && (!root.dataset.app || root.dataset.app==='stories');
  const states=cards.map(card=>({card,x:0,y:0,lift:0,light:0,spotX:50,spotY:50}));
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
  function draw(now){
    frame=0;
    if(!active()){reset();return;}
    const delta=lastTime?clamp(now-lastTime,1,48):16.667;lastTime=now;
    const still=reduced();grid.dataset.offerMotion=still?'reduced':'scroll';
    const tracking=!still && fine.matches && pointer && !document.querySelector('dialog[open]');
    const point=tracking?{x:pointer.x+scrollX,y:pointer.y+scrollY}:null;
    let moving=false;
    for(const item of metrics){
      const p=still ? .5 : Math.max(0,Math.min(1,(scrollY+innerHeight-item.top)/(innerHeight+item.height)));
      const value=p.toFixed(4);
      if(item.card.dataset.offerProgress!==value || item.still!==still){
        item.still=still;item.card.dataset.offerProgress=value;
        item.card.style.setProperty('--offer-progress',value);
        item.card.style.setProperty('--offer-glow',Math.sin(p*Math.PI).toFixed(4));
      }
      const state=item.state;
      const nx=tracking?clamp((point.x-item.left-item.width/2)/(item.width/2),-1,1):0;
      const ny=tracking?clamp((point.y-item.top-item.height/2)/(item.height/2),-1,1):0;
      // The neighbouring ticket answers more quietly; layout metrics never include its tilt.
      const distance=tracking?Math.hypot(Math.max(0,Math.abs(point.x-item.left-item.width/2)-item.width/2),Math.max(0,Math.abs(point.y-item.top-item.height/2)-item.height/2)):Infinity;
      const light=tracking?clamp(1-distance/350,0,1):0;
      const targets={x:-ny*3.6*light,y:nx*5.2*light,lift:-4*light,light,spotX:tracking?clamp((point.x-item.left)/item.width*100,0,100):50,spotY:tracking?clamp((point.y-item.top)/item.height*100,0,100):50};
      const ease=still?1:1-Math.exp(-delta/(tracking?115:240));
      for(const key of Object.keys(targets)){
        const difference=targets[key]-state[key];state[key]+=difference*ease;
        if(Math.abs(difference)<.015)state[key]=targets[key];else moving=true;
      }
      for(const [key,value] of Object.entries({'--offer-tilt-x':state.x+'deg','--offer-tilt-y':state.y+'deg','--offer-lift':state.lift+'px','--offer-pointer-light':state.light,'--offer-pointer-x':state.spotX+'%','--offer-pointer-y':state.spotY+'%'}))state.card.style.setProperty(key,String(value));
    }
    grid.dataset.offerTilt=tracking || moving?'active':'resting';
    if(moving)schedule();else lastTime=0;
  }
  function schedule(){if(!frame && !closed && !document.hidden)frame=requestAnimationFrame(draw);}
  function reset(){
    cancelAnimationFrame(frame);frame=0;lastTime=0;pointer=null;grid.dataset.offerTilt='resting';
    for(const state of states){Object.assign(state,{x:0,y:0,lift:0,light:0,spotX:50,spotY:50});
      for(const key of ['--offer-tilt-x','--offer-tilt-y','--offer-lift','--offer-pointer-light','--offer-pointer-x','--offer-pointer-y'])state.card.style.removeProperty(key);
    }
  }
  function measure(){
    if(!active()){reset();return;}
    metrics=cards.map((card,index)=>{
      // Visual transforms must not feed back into the next layout measurement.
      let top=0,left=0;for(let node=card;node;node=node.offsetParent){top+=node.offsetTop;left+=node.offsetLeft;}
      return{card,top,left,width:card.offsetWidth,height:card.offsetHeight,state:states[index]};
    });schedule();
  }
  grid.addEventListener('pointermove',event=>{
    if(!active() || reduced() || !fine.matches || event.pointerType==='touch')return;
    pointer={x:event.clientX,y:event.clientY};schedule();
  },{passive:true});
  grid.addEventListener('pointerleave',()=>{pointer=null;schedule();});
  grid.addEventListener('pointercancel',()=>{pointer=null;schedule();});
  addEventListener('blur',()=>{pointer=null;schedule();});
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);
  addEventListener('raccoon:appchange',measure);addEventListener('hanzi:languagechange',measure);
  media.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else measure();});
  new MutationObserver(()=>{reset();measure();}).observe(root,{attributes:true,attributeFilter:['data-motion','data-app']});
  fine.addEventListener('change',()=>{reset();schedule();});
  addEventListener('pagehide',()=>{closed=true;reset();});addEventListener('pageshow',()=>{closed=false;measure();});
  const observer=new ResizeObserver(measure);observer.observe(grid);cards.forEach(card=>observer.observe(card));
  document.fonts.ready.then(measure);measure();
})();
