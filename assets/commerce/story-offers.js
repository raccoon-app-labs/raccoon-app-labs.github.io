/* Tickets and information cards share one short-lived pointer animation clock. */
(() => {
  'use strict';
  const grids=[...document.querySelectorAll('.commerce-stories .offer-grid,.commerce-stories .commerce-details,.commerce-stories .commerce-get')];
  if(!grids.length)return;
  const root=document.documentElement,media=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const panel=grids[0].closest('[role=tabpanel]');
  let frame=0,metrics=[],lastTime=0,pointer=null,closed=false;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const reduced=()=>media.matches || root.dataset.motion==='reduced';
  const active=()=>!closed && !document.hidden && !panel?.hidden && (!root.dataset.app || root.dataset.app==='stories');
  const states=grids.flatMap(grid=>(grid.matches('.commerce-get')?[grid]:[...grid.querySelectorAll('.offer-card,.commerce-detail')]).map(card=>({card,grid,ticket:card.matches('.offer-card'),rendered:{},x:0,y:0,lift:0,light:0,spotX:50,spotY:50})));
  for(const [index,{card,ticket}] of states.entries()){
    if(!ticket){
      const magic=document.createElement('div');magic.className='detail-magic';magic.setAttribute('aria-hidden','true');magic.setAttribute('inert','');
      magic.innerHTML='<span class="detail-magic-light"></span>';card.prepend(magic);continue;
    }
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
    const still=reduced();for(const grid of grids)grid.dataset.offerMotion=still?'reduced':'scroll';
    const canTrack=!still && fine.matches && pointer && !document.querySelector('dialog[open]');
    const point=canTrack?{x:pointer.x+scrollX,y:pointer.y+scrollY}:null;
    let moving=false;const movingGrids=new Set();
    for(const item of metrics){
      const state=item.state,{grid,ticket}=state,tracking=canTrack && pointer.grid===grid;
      if(ticket){
        const p=still ? .5 : Math.max(0,Math.min(1,(scrollY+innerHeight-item.top)/(innerHeight+item.height)));
        const value=p.toFixed(4);
        if(item.card.dataset.offerProgress!==value || item.still!==still){
          item.still=still;item.card.dataset.offerProgress=value;
          item.card.style.setProperty('--offer-progress',value);
          item.card.style.setProperty('--offer-glow',Math.sin(p*Math.PI).toFixed(4));
        }
      }
      const nx=tracking?clamp((point.x-item.left-item.width/2)/(item.width/2),-1,1):0;
      const ny=tracking?clamp((point.y-item.top-item.height/2)/(item.height/2),-1,1):0;
      // The neighbouring ticket answers more quietly; layout metrics never include its tilt.
      const distance=tracking?Math.hypot(Math.max(0,Math.abs(point.x-item.left-item.width/2)-item.width/2),Math.max(0,Math.abs(point.y-item.top-item.height/2)-item.height/2)):Infinity;
      const light=tracking?clamp(1-distance/(ticket?350:170),0,1):0;
      const targets={x:-ny*(ticket?3.6:2.6)*light,y:nx*(ticket?5.2:3.6)*light,lift:-(ticket?4:2.5)*light,light,spotX:tracking?clamp((point.x-item.left)/item.width*100,0,100):50,spotY:tracking?clamp((point.y-item.top)/item.height*100,0,100):50};
      const ease=still?1:1-Math.exp(-delta/(tracking?115:240));
      let settled=true;
      for(const key of Object.keys(targets)){
        const difference=targets[key]-state[key];state[key]+=difference*ease;
        if(Math.abs(difference)<.015)state[key]=targets[key];else settled=false;
      }
      for(const [key,value] of Object.entries({'--offer-tilt-x':state.x+'deg','--offer-tilt-y':state.y+'deg','--offer-lift':state.lift+'px','--offer-pointer-light':state.light,'--offer-pointer-x':state.spotX+'%','--offer-pointer-y':state.spotY+'%'})){
        const next=String(value);if(state.rendered[key]!==next){state.card.style.setProperty(key,next);state.rendered[key]=next;}
      }
      if(tracking || !settled)movingGrids.add(grid);
      if(!settled)moving=true;
    }
    for(const grid of grids)grid.dataset.offerTilt=movingGrids.has(grid)?'active':'resting';
    if(moving)schedule();else lastTime=0;
  }
  function schedule(){if(!frame && !closed && !document.hidden)frame=requestAnimationFrame(draw);}
  function reset(){
    cancelAnimationFrame(frame);frame=0;lastTime=0;pointer=null;for(const grid of grids)grid.dataset.offerTilt='resting';
    for(const state of states){Object.assign(state,{rendered:{},x:0,y:0,lift:0,light:0,spotX:50,spotY:50});
      for(const key of ['--offer-tilt-x','--offer-tilt-y','--offer-lift','--offer-pointer-light','--offer-pointer-x','--offer-pointer-y'])state.card.style.removeProperty(key);
    }
  }
  function measure(){
    if(!active()){reset();return;}
    metrics=states.map(state=>{
      const {card}=state;
      // Visual transforms must not feed back into the next layout measurement.
      let top=0,left=0;for(let node=card;node;node=node.offsetParent){top+=node.offsetTop;left+=node.offsetLeft;}
      return{card,top,left,width:Math.max(1,card.offsetWidth),height:Math.max(1,card.offsetHeight),state};
    });schedule();
  }
  for(const grid of grids){
    grid.addEventListener('pointermove',event=>{
      if(!active() || reduced() || !fine.matches || event.pointerType==='touch')return;
      pointer={x:event.clientX,y:event.clientY,grid};schedule();
    },{passive:true});
    grid.addEventListener('pointerleave',()=>{pointer=null;schedule();});
    grid.addEventListener('pointercancel',()=>{pointer=null;schedule();});
  }
  addEventListener('blur',()=>{pointer=null;schedule();});
  addEventListener('scroll',()=>{if(pointer && !pointer.grid.matches('.offer-grid'))pointer=null;schedule();},{passive:true});addEventListener('resize',measure);
  addEventListener('raccoon:appchange',measure);addEventListener('hanzi:languagechange',measure);
  media.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else measure();});
  new MutationObserver(()=>{reset();measure();}).observe(root,{attributes:true,attributeFilter:['data-motion','data-app']});
  fine.addEventListener('change',()=>{reset();schedule();});
  addEventListener('pagehide',()=>{closed=true;reset();});addEventListener('pageshow',()=>{closed=false;measure();});
  const observer=new ResizeObserver(measure);grids.forEach(grid=>observer.observe(grid));states.forEach(({card})=>observer.observe(card));
  document.fonts.ready.then(measure);measure();
})();
