/* Pointer-driven letter springs for Bloom and Keys. No viewport overlay or idle loop. */
(() => {
  'use strict';
  const root=document.documentElement,content=document.getElementById('hanzi-content');
  if(!content || root.dataset.hanziHopReady)return;
  root.dataset.hanziHopReady='';
  const fine=matchMedia('(hover: hover) and (pointer: fine)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const areas=[document.querySelector('.topbar'),document.querySelector('.app-nav'),content,document.querySelector('.store-footer'),document.getElementById('mobile-buybar')].filter(Boolean);
  const skip='hanzi-hop,hanzi-hop-layer,script,style,noscript,svg,canvas,input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[aria-live],.sr-only,.story-magic-layer';
  const runs=new Set(),active=new Set(),cached=new Set(),byText=new WeakMap(),pending=new Set(),sparks=new Set();
  let frame=0,lastTime=0,pointer,lastPoint,dirty=true,closed=false,selection=false,serial=0,lastSpark=0;
  let geometry=[],scrolling=false,scrollTimer=0;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const enabled=()=>!closed && !scrolling && !root.dataset.siteScrolling && !document.hidden && fine.matches && !motion.matches && root.dataset.motion!=='reduced' && ['bloom','keys'].includes(root.dataset.app) && !selection && !document.querySelector('#language-dialog[data-open]');
  function schedule(){if(!frame && !closed)frame=requestAnimationFrame(draw);}
  function restore(run){
    run.source.removeAttribute('data-hop-painted');active.delete(run);
    if(run.layer)run.layer.hidden=true;
    for(const cell of run.cells){Object.assign(cell,{x:0,y:0,vx:0,vy:0,angle:0,va:0,due:0,power:0,land:0});cell.node.style.transform='none';}
  }
  function discard(run){restore(run);run.layer?.remove();run.layer=null;run.cells=[];run.dirty=true;cached.delete(run);}
  function clear(){
    cancelAnimationFrame(frame);frame=0;lastTime=0;pointer=lastPoint=undefined;
    for(const run of active)restore(run);
    for(const spark of sparks){spark.animation.cancel();spark.node.remove();}sparks.clear();
    root.dataset.hanziHopState='resting';
  }
  function register(text){
    const parent=text.parentElement;
    if(!parent || parent.closest(skip) || !/[\p{L}\p{N}]/u.test(text.data))return;
    const source=document.createElement('hanzi-hop');source.className='hanzi-hop-source';
    text.replaceWith(source);source.append(text);
    const run={source,text,cells:[],layer:null,dirty:true,size:16,lastIndex:-1,lastKick:-Infinity,id:serial++};
    runs.add(run);byText.set(text,run);
  }
  function scan(area){
    if(!area?.isConnected || area.nodeType!==Node.ELEMENT_NODE || area.closest(skip))return;
    const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode())texts.push(walker.currentNode);texts.forEach(register);dirty=true;
  }
  function measure(){
    geometry=[];
    for(const run of runs){
      if(!run.source.isConnected){discard(run);runs.delete(run);continue;}
      const rects=[...run.source.getClientRects()].filter(r=>r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight);
      if(rects.length)geometry.push({run,rects});
    }
    dirty=false;
  }
  function build(run){
    restore(run);
    run.layer?.remove();
    const layer=document.createElement('hanzi-hop-layer');layer.className='hanzi-hop-layer';
    layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');layer.dataset.noL10n='';
    layer.dataset.world=root.dataset.app;run.source.append(layer);run.layer=layer;
    const css=getComputedStyle(run.source);run.size=parseFloat(css.fontSize)||16;
    for(const key of ['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontFeatureSettings','fontVariationSettings','fontKerning','letterSpacing','textTransform'])layer.style[key]=css[key];
    layer.style.setProperty('--hop-base',css.color);
    const joining=/[\p{Script=Arabic}\p{Script=Devanagari}]/u.test(run.text.data);
    const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(root.lang||'en',{granularity:joining?'word':'grapheme'}):null;
    let offset=0;
    const parts=segmenter?[...segmenter.segment(run.text.data)]:Array.from(run.text.data,segment=>{const item={segment,index:offset};offset+=segment.length;return item;});
    const ranges=parts.filter(part=>part.segment.trim()).map(part=>{
      const range=document.createRange();range.setStart(run.text,part.index);range.setEnd(run.text,part.index+part.segment.length);return {part,range};
    });
    // Measure in the local paper plane. Restore every ancestor in this same frame.
    const transforms=[];
    for(let node=run.source;node && node!==document.documentElement;node=node.parentElement){
      const style=getComputedStyle(node);
      for(const key of ['transform','rotate','translate','scale'])if(style[key] && style[key]!=='none'){
        transforms.push({node,key,value:node.style.getPropertyValue(key),priority:node.style.getPropertyPriority(key)});
      }
    }
    const cells=[];
    try{
      for(const item of transforms)item.node.style.setProperty(item.key,'none','important');
      const origin=layer.getBoundingClientRect();
      for(const {part,range} of ranges){
        const rects=[...range.getClientRects()].filter(r=>r.width>0 && r.height>0);
        if(rects.length!==1)continue;
        const r=rects[0],node=document.createElement('hanzi-hop-letter');node.className='hanzi-hop-letter';
        // Generated paint never duplicates DOM text, copied text or accessible labels.
        node.dataset.glyph=part.segment;
        const left=r.left-origin.left,top=r.top-origin.top;
        Object.assign(node.style,{left:left+'px',top:top+'px',width:r.width+'px',height:r.height+'px',lineHeight:r.height+'px'});
        cells.push({node,range,left,top,width:r.width,height:r.height,x:0,y:0,vx:0,vy:0,angle:0,va:0,due:0,power:0,land:0});
      }
      if(cells.length){
        const left=Math.min(...cells.map(c=>c.left))-48,top=Math.min(...cells.map(c=>c.top))-48;
        const right=Math.max(...cells.map(c=>c.left+c.width))+48,bottom=Math.max(...cells.map(c=>c.top+c.height))+48;
        Object.assign(layer.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
        for(const cell of cells){cell.left-=left;cell.top-=top;cell.node.style.left=cell.left+'px';cell.node.style.top=cell.top+'px';layer.append(cell.node);}
      }
    }finally{
      for(const item of transforms.reverse())if(item.value)item.node.style.setProperty(item.key,item.value,item.priority);else item.node.style.removeProperty(item.key);
    }
    const origin=run.source.getBoundingClientRect();run.origin={x:origin.left,y:origin.top};
    for(const cell of cells){const r=cell.range.getBoundingClientRect();cell.screenX=r.left+r.width*.5;cell.screenY=r.top+r.height*.55;cell.range.detach();delete cell.range;}
    run.cells=cells;run.dirty=false;run.lastIndex=-1;layer.hidden=true;
    cached.delete(run);cached.add(run);
    for(const old of cached){if(cached.size<=12)break;if(old!==run && !active.has(old))discard(old);}
  }
  function pollen(run,cell,now){
    if(now-lastSpark<85 || sparks.size>=18)return;lastSpark=now;
    for(let i=0;i<3;i++){
      const node=document.createElement('i');node.className='hanzi-hop-spark';
      node.style.left=cell.left+cell.width*.5+'px';node.style.top=cell.top+cell.height*.4+'px';run.layer.append(node);
      const x=(i-1)*12+(Math.random()-.5)*8,y=-15-Math.random()*22;
      const animation=node.animate([{opacity:0,transform:'translate(0,0) scale(.25)'},{opacity:.8,offset:.2},
        {opacity:0,transform:`translate(${x}px,${y}px) rotate(${i*65-50}deg) scale(.1)`}],{duration:650+i*65,easing:'cubic-bezier(.15,.65,.3,1)'});
      const spark={node,animation};sparks.add(spark);const done=()=>{node.remove();sparks.delete(spark);};animation.finished.then(done,done);
    }
  }
  function excite(run,now,moved){
    if(run.dirty || !run.layer)build(run);
    const origin=run.source.getBoundingClientRect(),dx=origin.left-run.origin.x,dy=origin.top-run.origin.y;
    let index=-1,distance=Infinity;
    run.cells.forEach((cell,i)=>{const d=Math.hypot(cell.screenX+dx-pointer.x,cell.screenY+dy-pointer.y);if(d<distance){index=i;distance=d;}});
    if(index<0 || distance>clamp(run.size*.95,19,72))return;
    if(!moved && index===run.lastIndex)return;
    if(index===run.lastIndex && now-run.lastKick<160)return;
    run.lastIndex=index;run.lastKick=now;
    if(active.size>=6 && !active.has(run))restore(active.values().next().value);
    active.add(run);run.layer.hidden=false;run.source.dataset.hopPainted='';
    const reach=run.size>=28?6:4,height=clamp(run.size*.52,7,34);
    for(let i=Math.max(0,index-reach);i<=Math.min(run.cells.length-1,index+reach);i++){
      const step=Math.abs(i-index),cell=run.cells[i];
      cell.due=now+step*40;cell.power=height*Math.pow(.73,step);cell.sign=i<index?-1:1;
    }
    pollen(run,run.cells[index],now);
  }
  function draw(now){
    frame=0;
    for(const area of pending)scan(area);pending.clear();
    if(!enabled()){clear();return;}
    const delta=lastTime?clamp((now-lastTime)/16.667,.25,2.5):1;lastTime=now;
    if(dirty)measure();
    const moved=pointer && (!lastPoint || Math.hypot(pointer.x-lastPoint.x,pointer.y-lastPoint.y)>7);
    if(pointer){
      for(const {run,rects} of geometry){
        const near=rects.some(r=>Math.hypot(Math.max(r.left-pointer.x,0,pointer.x-r.right),Math.max(r.top-pointer.y,0,pointer.y-r.bottom))<clamp(r.height*.75,14,48));
        if(near)excite(run,now,moved);
      }
      if(moved)lastPoint={...pointer};
    }
    for(const run of active){
      if(!run.source.isConnected){restore(run);continue;}
      let moving=false;
      for(const cell of run.cells){
        if(cell.due && now>=cell.due){
          cell.vy=-cell.power*.48;cell.vx=cell.sign*cell.power*.045;cell.va=cell.sign*clamp(cell.power*.11,.4,2.7);cell.due=0;
        }
        if(cell.due)moving=true;
        const wasUp=cell.y<-.4;
        cell.vx=(cell.vx-cell.x*.1*delta)*Math.pow(.78,delta);cell.vy=(cell.vy-cell.y*.075*delta)*Math.pow(.84,delta);
        cell.va=(cell.va-cell.angle*.1*delta)*Math.pow(.78,delta);
        cell.x+=cell.vx*delta;cell.y+=cell.vy*delta;cell.angle+=cell.va*delta;
        if(wasUp && cell.y>=0)cell.land=1;
        cell.land*=Math.pow(.76,delta);
        const stretch=Math.min(.16,Math.abs(cell.vy)*.019),squash=cell.land*.13;
        const energy=Math.abs(cell.x)+Math.abs(cell.y)+Math.abs(cell.vx)+Math.abs(cell.vy)+Math.abs(cell.angle);
        if(energy>.06 || cell.land>.02)moving=true;
        else{cell.x=cell.y=cell.vx=cell.vy=cell.angle=cell.va=0;}
        cell.node.style.transform=`translate3d(${cell.x.toFixed(2)}px,${cell.y.toFixed(2)}px,0) rotate(${cell.angle.toFixed(2)}deg) scale(${(1-stretch*.4+squash).toFixed(3)},${(1+stretch-squash).toFixed(3)})`;
        cell.node.style.textShadow=energy>.2?'0 0 7px color-mix(in srgb,var(--theme-accent,var(--accent)) 28%,transparent)':'none';
      }
      if(!moving)restore(run);
    }
    root.dataset.hanziHopState=active.size?'animating':'resting';
    if(active.size)schedule();else lastTime=0;
  }
  areas.forEach(scan);
  new MutationObserver(records=>{
    let changed=false;
    for(const record of records){
      if(record.type==='characterData'){
        const run=byText.get(record.target);if(run){restore(run);run.dirty=true;dirty=true;changed=true;}continue;
      }
      if(record.target.closest?.('hanzi-hop,hanzi-hop-layer,.story-magic-layer'))continue;
      for(const node of record.addedNodes){const area=areas.find(area=>area.contains(node));if(area){pending.add(area);changed=true;}}
      if(record.removedNodes.length){dirty=true;changed=true;}
    }
    if(changed)schedule();
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
  function invalidate(){clear();dirty=true;for(const run of cached)discard(run);if(pending.size)schedule();}
  function scroll(){
    if(!scrolling){scrolling=true;clear();dirty=true;}
    clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;dirty=true;},150);
  }
  document.addEventListener('pointermove',event=>{
    if(!enabled()){if(active.size)clear();return;}
    if(event.pointerType==='touch' || !event.isPrimary)return;
    pointer={x:event.clientX,y:event.clientY};schedule();
  },{passive:true});
  document.addEventListener('pointerdown',event=>{if(event.target.closest('.language-launch,#language-dialog'))clear();},{capture:true,passive:true});
  root.addEventListener('pointerleave',()=>{pointer=lastPoint=undefined;if(active.size)schedule();});
  document.addEventListener('scroll',scroll,{capture:true,passive:true});
  document.addEventListener('selectionchange',()=>{const s=getSelection();selection=Boolean(s && !s.isCollapsed);if(selection)clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  new ResizeObserver(invalidate).observe(content);
  new MutationObserver(invalidate).observe(root,{attributes:true,attributeFilter:['data-app','data-motion','data-theme']});
  window.addEventListener('resize',invalidate,{passive:true});window.addEventListener('blur',clear);
  window.addEventListener('hanzi:languagechange',invalidate);
  motion.addEventListener('change',invalidate);fine.addEventListener('change',invalidate);
  document.fonts?.ready.then(invalidate);
  window.addEventListener('pagehide',()=>{closed=true;clearTimeout(scrollTimer);scrolling=false;clear();});
  window.addEventListener('pageshow',()=>{closed=false;invalidate();});
})();
