/* Native text stays in place: only a small, inert echo reacts to the pointer. */
(() => {
  'use strict';
  const root=document.documentElement;
  if(root.dataset.siteWorld!=='studio'||root.dataset.studioTextHover)return;
  const selectors=[['.hero-copy h1,.section-top h2,.values h2,.app-card h3','hologram'],['.hero-copy .intro,.section-copy,.developer-lead','ink'],['.hero-copy .eyebrow,.hero-note,.section-kicker,.hero-cta','signal']];
  const targets=new Map();
  for(const [selector,kind] of selectors)for(const node of document.querySelectorAll(selector))targets.set(node,{node,kind,rect:null,layers:[]});
  if(!targets.size)return;
  root.dataset.studioTextHover='ready';
  const fine=matchMedia('(hover: hover) and (pointer: fine)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let active=null,pointer=null,frame=0,pulse=0,closed=false,selecting=false;
  const allowed=()=>fine.matches&&!motion.matches&&root.dataset.motion!=='reduced'&&!root.dataset.siteScrolling&&!document.hidden&&!closed&&!selecting;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function clear(){
    cancelAnimationFrame(frame);frame=0;clearTimeout(pulse);pulse=0;pointer=null;
    if(active){active.node.removeAttribute('data-studio-active');active.node.removeAttribute('data-studio-surge');active=null;}
  }
  function invalidate(){
    clear();
    for(const entry of targets.values()){
      entry.rect=null;for(const layer of entry.layers)layer.remove();entry.layers=[];
    }
  }
  function echoes(entry){
    if(entry.kind!=='hologram'||entry.layers.length)return;
    const source=[...entry.node.childNodes].filter(child=>!child.hasAttribute?.('data-studio-echo'));
    for(const kind of ['spectrum','ribbon']){
      const layer=document.createElement('span');layer.className='studio-text-echo studio-text-'+kind;
      layer.dataset.studioEcho='';layer.dataset.noL10n='';layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
      layer.append(...source.map(child=>child.cloneNode(true)));
      for(const duplicate of layer.querySelectorAll?.('[id]')||[])duplicate.removeAttribute('id');
      entry.node.append(layer);entry.layers.push(layer);
    }
  }
  function draw(){
    frame=0;if(!active||!pointer||!allowed()){clear();return;}
    const rect=active.rect,x=clamp(pointer.x-rect.left,0,rect.width),y=clamp(pointer.y-rect.top,0,rect.height);
    const dx=(x/Math.max(1,rect.width)-.5)*5,dy=(y/Math.max(1,rect.height)-.5)*3;
    for(const [name,value] of [['--studio-x',x.toFixed(2)+'px'],['--studio-y',y.toFixed(2)+'px'],['--studio-dx',dx.toFixed(2)+'px'],['--studio-dy',dy.toFixed(2)+'px']])active.node.style.setProperty(name,value);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  function enter(entry,event){
    if(event.pointerType==='touch'||!allowed())return;
    if(active!==entry){
      clear();
      // Read layout/style together once. Pointer frames only write cached coordinates.
      const rect=entry.rect||entry.node.getBoundingClientRect(),style=getComputedStyle(entry.node);
      entry.rect=rect;const size=parseFloat(style.fontSize)||18;
      entry.node.style.setProperty('--studio-base',style.color);
      entry.node.style.setProperty('--studio-radius',clamp(size*2.1,80,210).toFixed(0)+'px');
      echoes(entry);active=entry;entry.node.dataset.studioActive='';entry.node.dataset.studioSurge='';
      pulse=setTimeout(()=>{entry.node.removeAttribute('data-studio-surge');pulse=0;},1100);
    }
    pointer={x:event.clientX,y:event.clientY};schedule();
  }
  for(const entry of targets.values()){
    entry.node.dataset.studioText=entry.kind;
    entry.node.addEventListener('pointerenter',event=>enter(entry,event),{passive:true});
    entry.node.addEventListener('pointermove',event=>enter(entry,event),{passive:true});
    entry.node.addEventListener('pointerleave',()=>{if(active===entry)clear();},{passive:true});
    entry.node.addEventListener('pointercancel',clear,{passive:true});
  }
  const changed=records=>{
    if(records.some(record=>{const target=record.target.nodeType===3?record.target.parentElement:record.target;return !target?.closest?.('[data-studio-echo]')&&(record.type==='characterData'||[...record.addedNodes,...record.removedNodes].some(node=>!node.hasAttribute?.('data-studio-echo')));} ))invalidate();
  };
  if(typeof MutationObserver==='function'){
    const textObserver=new MutationObserver(changed);
    for(const entry of targets.values())textObserver.observe(entry.node,{childList:true,characterData:true,subtree:true});
    new MutationObserver(invalidate).observe(root,{attributes:true,attributeFilter:['lang','data-theme','data-motion']});
  }
  if(typeof ResizeObserver==='function'){
    const resize=new ResizeObserver(invalidate);for(const entry of targets.values())resize.observe(entry.node);
  }
  if(typeof IntersectionObserver==='function'){
    const visible=new IntersectionObserver(entries=>{if(active&&entries.some(entry=>entry.target===active.node&&!entry.isIntersecting))clear();});
    for(const entry of targets.values())visible.observe(entry.node);
  }
  document.addEventListener('selectionchange',()=>{selecting=!window.getSelection()?.isCollapsed;if(selecting)clear();});
  document.addEventListener('scroll',()=>{clear();for(const entry of targets.values())entry.rect=null;},{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('raccoon:scrollstate',()=>{if(root.dataset.siteScrolling)clear();});
  window.addEventListener('hanzi:languagechange',invalidate);window.addEventListener('resize',invalidate,{passive:true});window.addEventListener('blur',clear);
  window.addEventListener('pagehide',()=>{closed=true;invalidate();});window.addEventListener('pageshow',()=>{closed=false;invalidate();});
  fine.addEventListener('change',invalidate);motion.addEventListener('change',invalidate);
  document.fonts?.ready.then(invalidate).catch(()=>{});
})();
