/* Electric ink follows the pointer while every original text node stays in native flow. */
(() => {
  'use strict';
  const root=document.documentElement,panel=document.getElementById('neon-panel') || document.querySelector('body[data-product="neon"] main');
  if(!panel || root.dataset.neonInkReady)return;
  root.dataset.neonInkReady='';
  const fine=matchMedia('(hover: hover) and (pointer: fine)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const areas=[document.querySelector('.topbar,.site-header'),document.querySelector('.app-nav'),panel,document.querySelector('.store-footer,body[data-product="neon"] footer')].filter(Boolean);
  const skip='neon-ink,script,style,noscript,svg,canvas,input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[aria-live],.sr-only,.story-magic-layer';
  const runs=new Set(),lit=new Set(),pending=new Set();
  const normal=[[52,227,219],[255,121,107],[255,227,107]];
  const deep=[[8,103,126],[153,46,86],[125,86,12]];
  let frame=0,lastTime=0,pointer,geometry=[],dirty=true,closed=false,serial=0,selection=false;
  const still=()=>motion.matches || root.dataset.motion==='reduced';
  const enabled=()=>!closed && !document.hidden && (root.dataset.app==='neon' || root.dataset.siteWorld==='neon') && fine.matches && !selection;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const mix=(a,b,t)=>'rgb('+a.map((n,i)=>Math.round(n+(b[i]-n)*t)).join(' ')+')';

  function register(text){
    const parent=text.parentElement;
    if(!parent || parent.closest(skip) || !/[\p{L}\p{N}]/u.test(text.data))return;
    const node=document.createElement('neon-ink');node.className='neon-ink-text';
    // Moving the same Text node preserves the locale engine's source tracking.
    text.replaceWith(node);node.append(text);
    runs.add({node,parent,charge:0,x:0,y:0,targetX:0,targetY:0,radius:100,start:0,id:serial++,palette:normal});
  }
  function scan(area){
    if(!area?.isConnected || area.nodeType!==Node.ELEMENT_NODE || area.closest(skip))return;
    const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode())texts.push(walker.currentNode);
    texts.forEach(register);dirty=true;
  }
  function schedule(){if(!frame && !closed)frame=requestAnimationFrame(draw);}
  function unlight(run){
    run.node.removeAttribute('data-ink-lit');run.charge=0;lit.delete(run);
  }
  function clear(){
    cancelAnimationFrame(frame);frame=0;lastTime=0;pointer=undefined;
    for(const run of lit)unlight(run);
  }
  function measure(){
    geometry=[];
    for(const run of runs){
      if(!run.node.isConnected){lit.delete(run);runs.delete(run);continue;}
      const rects=[...run.node.getClientRects()].filter(r=>r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth);
      if(rects.length)geometry.push({run,rects});
    }
    dirty=false;
  }
  function activate(run,rect,now){
    const style=getComputedStyle(run.node.parentElement);
    const size=parseFloat(style.fontSize)||16;
    run.radius=clamp(size*2.4,75,235);
    const yellow=run.node.closest('.app-tab[aria-selected="true"],.button:not(.secondary),.art-stamp');
    run.palette=root.dataset.theme==='light' || yellow?deep:normal;
    run.node.style.setProperty('--ink-base',style.color);
    run.node.style.setProperty('--ink-radius',run.radius+'px');
    run.node.style.setProperty('--ink-charge','0');
    run.start=now;run.x=pointer.x-rect.left;run.y=pointer.y-rect.top;
    run.node.setAttribute('data-ink-lit','');lit.add(run);
  }
  function draw(now){
    frame=0;
    for(const area of pending)scan(area);pending.clear();
    if(!enabled()){clear();return;}
    if(lastTime && now-lastTime<1000/30){schedule();return;}
    const dt=lastTime?Math.min(64,now-lastTime):33;lastTime=now;
    if(dirty)measure();
    const targets=new Map();
    if(pointer){
      // Read all geometry first, before changing any paint styles.
      for(const {run,rects} of geometry){
        let best=Infinity,rect;
        for(const r of rects){
          const distance=Math.hypot(Math.max(r.left-pointer.x,0,pointer.x-r.right),Math.max(r.top-pointer.y,0,pointer.y-r.bottom));
          if(distance<best){best=distance;rect=r;}
        }
        const range=clamp(rect.height*1.1,30,92);
        if(best>range)continue;
        targets.set(run,{rect,power:Math.pow(1-best/range,1.25)});
      }
    }
    for(const [run,target] of targets)if(!lit.has(run))activate(run,target.rect,now);
    const reduced=still();
    for(const run of lit){
      const target=targets.get(run),power=target?.power || 0;
      const ease=reduced?1:1-Math.exp(-dt/(power>run.charge?75:235));
      run.charge+=(power-run.charge)*ease;
      if(run.charge<.012 && !power){unlight(run);continue;}
      if(target){run.targetX=pointer.x-target.rect.left;run.targetY=pointer.y-target.rect.top;}
      const follow=reduced?1:1-Math.exp(-dt/85);
      run.x+=(run.targetX-run.x)*follow;run.y+=(run.targetY-run.y)*follow;
      const phase=reduced?0:(now-run.start)/900+run.id*.13;
      const index=Math.floor(phase)%3,t=reduced?0:(phase%1)**2*(3-2*(phase%1));
      for(const [offset,name] of ['--ink-a','--ink-b','--ink-c'].entries()){
        run.node.style.setProperty(name,mix(run.palette[(index+offset)%3],run.palette[(index+offset+1)%3],t));
      }
      const pulse=reduced?0:Math.sin((now-run.start)/320)*run.radius*.12;
      run.node.style.setProperty('--ink-x',(run.x+pulse).toFixed(2)+'px');
      run.node.style.setProperty('--ink-y',run.y.toFixed(2)+'px');
      run.node.style.setProperty('--ink-charge',run.charge.toFixed(4));
    }
    if(lit.size && !reduced)schedule();else lastTime=0;
  }

  areas.forEach(scan);
  new MutationObserver(records=>{
    let changed=false;
    for(const record of records){
      if(record.type==='characterData'){dirty=true;changed=true;continue;}
      if(record.target.closest?.('neon-ink,.story-magic-layer'))continue;
      for(const node of record.addedNodes){
        const area=areas.find(area=>area.contains(node));
        if(area){pending.add(area);changed=true;}
      }
      if(record.removedNodes.length){dirty=true;changed=true;}
    }
    if(changed)schedule();
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
  new ResizeObserver(()=>{dirty=true;if(pointer)schedule();}).observe(panel);
  new MutationObserver(()=>{clear();dirty=true;}).observe(root,{attributes:true,attributeFilter:['data-app','data-theme','data-motion']});
  document.addEventListener('pointermove',event=>{
    if(!enabled() || !event.isPrimary || event.pointerType==='touch')return;
    pointer={x:event.clientX,y:event.clientY};schedule();
  },{passive:true});
  root.addEventListener('pointerleave',()=>{pointer=undefined;if(still())clear();else schedule();});
  document.addEventListener('scroll',()=>{clear();dirty=true;},{capture:true,passive:true});
  document.addEventListener('selectionchange',()=>{selection=!getSelection()?.isCollapsed;if(selection)clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('resize',()=>{clear();dirty=true;},{passive:true});
  window.addEventListener('blur',clear);
  window.addEventListener('hanzi:languagechange',()=>{clear();dirty=true;});
  motion.addEventListener('change',clear);fine.addEventListener('change',clear);
  document.fonts?.ready.then(()=>{dirty=true;});
  window.addEventListener('pagehide',()=>{closed=true;clear();});
  window.addEventListener('pageshow',()=>{closed=false;dirty=true;});
})();
