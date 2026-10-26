/* One viewport-aware floating-type engine for the entire Stories page and its dialogs. */
(() => {
  'use strict';
  if(document.querySelector('.story-magic-layer'))return;
  const root=document.documentElement;
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const own='.story-magic-source,.story-magic-layer';
  const skip='script,style,noscript,svg,canvas,input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[aria-hidden="true"],[aria-live],.skip-link,.sr-only,#hanzi-content,#neon-panel,.payment-atmosphere,.language-announcement';
  const runs=new Set(),bySource=new WeakMap(),parents=new Map(),layers=new Map(),sparks=new Set(),pending=new Set([document.body]);
  let frame=0,lastTime=0,closed=false,settleTimer=0,lastSpark=0,seed=0;
  let pointer={x:0,y:0,inside:false},sparkPoint={x:0,y:0},hovered=null,selection=false;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const stories=()=>root.dataset.app?root.dataset.app==='stories':root.dataset.paymentAtmosphere==='stories' || root.dataset.siteWorld==='stories' || document.body.hasAttribute('data-story-checkout');
  const enabled=()=>!closed && !document.hidden && root.clientWidth>0 && innerHeight>0 && stories() && !selection && !motion.matches && root.dataset.motion!=='reduced';
  const internal=node=>(node.nodeType===Node.ELEMENT_NODE?node:node.parentElement)?.closest?.(own);
  function queue(){if(!frame && !closed)frame=requestAnimationFrame(draw);}
  function clearSparks(){for(const spark of sparks){spark.animation.cancel();spark.node.remove();}sparks.clear();}
  function restore(run){run.source.removeAttribute('data-painted');if(run.group)run.group.hidden=true;}
  function pause(){cancelAnimationFrame(frame);frame=0;lastTime=0;pointer.inside=false;clearSparks();for(const run of runs)restore(run);root.dataset.storyTypeState='paused';}
  function dirty(){for(const run of runs)run.dirty=true;clearSparks();queue();}
  function settle(){clearTimeout(settleTimer);settleTimer=setTimeout(dirty,520);}
  function layerFor(parent){
    const host=parent.closest('dialog,[popover]') || document.body;
    let layer=layers.get(host);
    if(!layer?.node.isConnected){
      const node=document.createElement('div');node.className='story-magic-layer';
      node.setAttribute('aria-hidden','true');node.setAttribute('inert','');node.dataset.noL10n='';
      host.append(node);layer={host,node};layers.set(host,layer);
    }
    return layer;
  }
  const intersection=new IntersectionObserver(entries=>{
    for(const entry of entries)for(const run of parents.get(entry.target) || []){
      run.visible=entry.isIntersecting;if(run.visible)run.dirty=true;else restore(run);
    }
    queue();
  },{rootMargin:'12px'});
  const resize=new ResizeObserver(entries=>{for(const entry of entries)for(const run of parents.get(entry.target) || [])run.dirty=true;queue();});
  function register(text){
    const parent=text.parentElement;
    if(!parent || internal(parent) || parent.closest(skip) || !/[\p{L}\p{N}]/u.test(text.data))return;
    const source=document.createElement('span');source.className='story-magic-source';text.replaceWith(source);source.append(text);
    const run={source,parent,text,visible:false,dirty:true,cells:[],group:null,layer:null,size:16,serial:seed++};
    runs.add(run);bySource.set(source,run);
    if(!parents.has(parent)){parents.set(parent,new Set());intersection.observe(parent);resize.observe(parent);}
    parents.get(parent).add(run);
  }
  function scan(node){
    if(!node?.isConnected || internal(node))return;
    if(node.nodeType===Node.TEXT_NODE){register(node);return;}
    if(node.nodeType!==Node.ELEMENT_NODE || node.closest(skip))return;
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode())texts.push(walker.currentNode);texts.forEach(register);
  }
  function clean(){
    for(const run of runs)if(!run.source.isConnected || run.source.parentElement!==run.parent){
      run.group?.remove();runs.delete(run);const siblings=parents.get(run.parent);siblings?.delete(run);
      if(!siblings?.size){intersection.unobserve(run.parent);resize.unobserve(run.parent);parents.delete(run.parent);}
    }
    for(const [host,layer] of layers)if(!host.isConnected){layer.node.remove();layers.delete(host);}
  }
  function style(run){
    const css=getComputedStyle(run.parent),group=run.group;run.size=parseFloat(css.fontSize)||16;
    for(const prop of ['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontFeatureSettings','fontVariationSettings','fontKerning','letterSpacing','textTransform','color'])group.style[prop]=css[prop];
    let opacity=1;run.clips=[];
    for(let node=run.parent;node && node!==run.layer.host.parentElement;node=node.parentElement){
      const ancestor=getComputedStyle(node);opacity*=parseFloat(ancestor.opacity)||0;
      const x=/hidden|clip|auto|scroll/.test(ancestor.overflowX),y=/hidden|clip|auto|scroll/.test(ancestor.overflowY);
      if(x || y || (node===run.layer.host && node!==document.body))run.clips.push({node,x:x || node===run.layer.host,y:y || node===run.layer.host});
    }
    group.style.opacity=String(opacity);
  }
  function build(run,bounds,layerBounds){
    restore(run);run.layer=layerFor(run.parent);
    if(!run.group){run.group=document.createElement('span');run.group.className='story-magic-run';}
    if(run.group.parentElement!==run.layer.node)run.layer.node.append(run.group);style(run);
    const joining=/[\p{Script=Arabic}\p{Script=Devanagari}]/u.test(run.text.data);
    const language=run.parent.closest('[lang]')?.lang || root.lang || 'en';
    const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(language,{granularity:joining?'word':'grapheme'}):null;
    let offset=0;
    const parts=segmenter?segmenter.segment(run.text.data):Array.from(run.text.data,segment=>{const item={segment,index:offset};offset+=segment.length;return item;});
    const fragment=document.createDocumentFragment(),cells=[];
    const scaleX=run.layer.node.clientWidth?layerBounds.width/run.layer.node.clientWidth:1;
    const scaleY=run.layer.node.clientHeight?layerBounds.height/run.layer.node.clientHeight:1;
    if(!scaleX || !scaleY)return;
    for(const part of parts){
      if(!part.segment.trim())continue;
      const range=document.createRange();range.setStart(run.text,part.index);range.setEnd(run.text,part.index+part.segment.length);
      const rects=[...range.getClientRects()].filter(rect=>rect.width>0 && rect.height>0);
      if(rects.length!==1){run.cells=[];run.group.replaceChildren();run.dirty=false;return;}
      const rect=rects[0],node=document.createElement('span');node.className='story-magic-letter';node.textContent=part.segment;
      const left=(rect.left-bounds.left)/scaleX,top=(rect.top-bounds.top)/scaleY;
      Object.assign(node.style,{left:left+'px',top:top+'px',width:rect.width/scaleX+'px',height:rect.height/scaleY+'px',lineHeight:rect.height/scaleY+'px'});
      fragment.append(node);
      cells.push({node,left,top,width:rect.width/scaleX,height:rect.height/scaleY,x:0,y:0,vx:0,vy:0,angle:0,glow:-1,phase:(cells.length+run.serial*3)*1.73,speed:.72+(cells.length%7)*.047});
    }
    run.group.replaceChildren(fragment);run.cells=cells;run.dirty=false;
  }
  function sparkle(run,cell,x,y,now){
    if(sparks.size>=12 || now-lastSpark<115 || !pointer.inside || Math.hypot(pointer.x-sparkPoint.x,pointer.y-sparkPoint.y)<12)return;
    lastSpark=now;sparkPoint={x:pointer.x,y:pointer.y};
    const node=document.createElement('i');node.className='story-magic-spark';node.textContent=sparks.size%3?'✦':'✧';
    node.style.left=x+cell.left+cell.width*.5+'px';node.style.top=y+cell.top+cell.height*.5+'px';
    node.style.fontSize=clamp(run.size*.15,4,10)+'px';run.layer.node.append(node);
    const animation=node.animate([{opacity:0,transform:'translate(0,0) scale(.2)'},{opacity:.65,offset:.18},
      {opacity:0,transform:`translate(${(Math.random()-.5)*24}px,${-15-Math.random()*20}px) rotate(95deg) scale(.1)`}],
      {duration:850+Math.random()*350,easing:'cubic-bezier(.2,.65,.3,1)'});
    const item={node,animation};sparks.add(item);const remove=()=>{node.remove();sparks.delete(item);};animation.finished.then(remove,remove);
  }
  function draw(now){
    frame=0;clean();if(!enabled()){pause();return;}
    if(lastTime && now-lastTime<1000/36){queue();return;}
    const delta=lastTime?clamp((now-lastTime)/16.667,.25,3):1;lastTime=now;
    for(const node of pending)scan(node);pending.clear();
    const modal=[...document.querySelectorAll('dialog[open]')].at(-1) || null;
    const plans=[],rects=new Map(),layerRects=new Map();
    const nav=document.querySelector('.app-nav')?.getBoundingClientRect();
    for(const run of runs){
      if(!run.visible || (modal && !modal.contains(run.parent))){restore(run);continue;}
      let bounds=rects.get(run.parent);if(!bounds){bounds=run.parent.getBoundingClientRect();rects.set(run.parent,bounds);}
      if(!bounds.width || !bounds.height || bounds.bottom<0 || bounds.top>innerHeight || bounds.right<0 || bounds.left>innerWidth){restore(run);continue;}
      const layer=layerFor(run.parent);if(layer!==run.layer)run.dirty=true;
      const belowNav=layer.host===document.body && run.parent.closest('main,.store-footer');
      if(belowNav && nav && bounds.bottom<=nav.bottom){restore(run);continue;}
      let layerBounds=layerRects.get(layer);if(!layerBounds){layerBounds=layer.node.getBoundingClientRect();layerRects.set(layer,layerBounds);}
      plans.push({run,bounds,layer,layerBounds,navBottom:belowNav && nav?nav.bottom:0});
    }
    let nearest=null,best=0,total=0;
    for(const plan of plans){
      const {run,bounds,layerBounds}=plan;
      if(run.dirty)try{build(run,bounds,layerBounds);}catch{restore(run);run.cells=[];run.dirty=false;}
      if(!run.cells.length)continue;
      const sx=plan.layer.node.clientWidth?layerBounds.width/plan.layer.node.clientWidth:1;
      const sy=plan.layer.node.clientHeight?layerBounds.height/plan.layer.node.clientHeight:1;if(!sx || !sy)continue;
      const x=(bounds.left-layerBounds.left)/sx,y=(bounds.top-layerBounds.top)/sy;
      let left=0,right=root.clientWidth,top=plan.navBottom,bottom=innerHeight;
      for(const clip of run.clips || []){
        let rect=rects.get(clip.node);if(!rect){rect=clip.node.getBoundingClientRect();rects.set(clip.node,rect);}
        if(clip.x){left=Math.max(left,rect.left);right=Math.min(right,rect.right);}
        if(clip.y){top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);}
      }
      if(right<=bounds.left || left>=bounds.right || bottom<=bounds.top || top>=bounds.bottom){restore(run);continue;}
      Object.assign(run.group.style,{width:bounds.width/sx+'px',height:bounds.height/sy+'px',
        clipPath:`inset(${Math.max(-32,(top-bounds.top)/sy)}px ${Math.max(-32,(bounds.right-right)/sx)}px ${Math.max(-32,(bounds.bottom-bottom)/sy)}px ${Math.max(-32,(left-bounds.left)/sx)}px)`,
        transform:`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`});
      run.group.hidden=false;run.source.dataset.painted='true';
      const px=(pointer.x-bounds.left)/sx,py=(pointer.y-bounds.top)/sy;
      const time=now/1000,amplitude=clamp(run.size*.032,.22,2.7),radius=clamp(run.size*2.2,48,170),pushLimit=clamp(run.size*.125,.8,8);
      for(const cell of run.cells){
        const dx=cell.left+cell.width/2-px,dy=cell.top+cell.height*.55-py,distance=Math.hypot(dx,dy);
        const influence=pointer.inside?Math.pow(Math.max(0,1-distance/radius),2):0;
        const idle=Math.sin(time*cell.speed+cell.phase),push=influence*pushLimit;
        const targetX=Math.sin(time*.54+cell.phase)*amplitude*.32+dx/Math.max(distance,1)*push;
        const targetY=idle*amplitude+dy/Math.max(distance,1)*push,damp=Math.pow(.78,delta);
        cell.vx=(cell.vx+(targetX-cell.x)*.075*delta)*damp;cell.vy=(cell.vy+(targetY-cell.y)*.075*delta)*damp;
        cell.x+=cell.vx*delta;cell.y+=cell.vy*delta;
        const angle=idle*(run.size>=28?.45:.2)+clamp(dx/radius,-1,1)*influence*(run.size>=28?3:1.1);
        cell.angle+=(angle-cell.angle)*(1-Math.pow(.86,delta));
        cell.node.style.transform=`translate3d(${cell.x.toFixed(2)}px,${cell.y.toFixed(2)}px,0) rotate(${cell.angle.toFixed(2)}deg)`;
        const glow=Math.round((.12+(idle+1)*.055+influence*.8)*24)/24;
        if(glow!==cell.glow){cell.glow=glow;const scale=clamp(run.size/55,.3,1);
          cell.node.style.textShadow=`0 0 ${(2+glow*13)*scale}px rgba(255,221,157,${(.1+glow*.4)*scale}),0 0 ${(8+glow*25)*scale}px rgba(237,180,104,${glow*.2*scale})`;
        }
        if(influence>best){best=influence;nearest={run,cell,x,y};}
      }
      total+=run.cells.length;
    }
    if(nearest && best>.18)sparkle(nearest.run,nearest.cell,nearest.x,nearest.y,now);
    root.dataset.storyTypeState=plans.length?'active':'idle';if(root.dataset.storyTypeVisible!==String(total))root.dataset.storyTypeVisible=String(total);
    if(plans.length)queue();else lastTime=0;
  }
  new MutationObserver(records=>{
    let changed=false;
    for(const record of records){
      if(internal(record.target)){
        if(record.type==='characterData'){const run=bySource.get(record.target.parentElement);if(run){run.dirty=true;changed=true;}}
        continue;
      }
      if(record.type==='childList'){
        for(const node of record.addedNodes)if(!internal(node)){pending.add(node);changed=true;}
        if([...record.removedNodes].some(node=>!node.isConnected))changed=true;
      }else changed=true;
    }
    if(changed){dirty();settle();}
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','disabled','aria-disabled','aria-hidden','open','lang','dir']});
  new MutationObserver(()=>{pending.add(document.body);dirty();settle();}).observe(root,{attributes:true,attributeFilter:['data-app','data-motion','data-theme','lang','dir']});
  document.addEventListener('pointermove',event=>{
    if(!fine.matches || event.pointerType==='touch' || !enabled())return;
    pointer={x:event.clientX,y:event.clientY,inside:true};
    if(hovered!==event.target){
      for(const run of runs)if(run.parent.contains(event.target) || run.parent.contains(hovered) || event.target.contains?.(run.parent) || hovered?.contains?.(run.parent))run.dirty=true;
      hovered=event.target;settle();
    }
    queue();
  },{passive:true});
  root.addEventListener('pointerleave',()=>{pointer.inside=false;hovered=null;});
  document.addEventListener('scroll',queue,{capture:true,passive:true});
  document.addEventListener('selectionchange',()=>{const next=!getSelection()?.isCollapsed;if(selection!==next){selection=next;dirty();}});
  addEventListener('resize',dirty,{passive:true});
  addEventListener('raccoon:appchange',()=>{pause();pending.add(document.body);dirty();settle();});
  addEventListener('hanzi:languagechange',()=>{pending.add(document.body);dirty();settle();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else dirty();});
  motion.addEventListener('change',dirty);fine.addEventListener('change',()=>{pointer.inside=false;});
  document.fonts?.ready.then(dirty);document.fonts?.addEventListener('loadingdone',dirty);
  addEventListener('pagehide',()=>{closed=true;pause();clearTimeout(settleTimer);});
  addEventListener('pageshow',()=>{closed=false;pending.add(document.body);dirty();});
  queue();
})();
