/* Gentle floating type, measured from untouched text so the book layout stays put. */
(() => {
  'use strict';
  const title=document.querySelector('.commerce-stories .story-hero-copy h1');
  if(!title || title.classList.contains('story-title'))return;
  const root=document.documentElement;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const source=document.createElement('span');source.className='story-title-source';
  source.append(...title.childNodes);
  const visual=document.createElement('span');visual.className='story-title-visual';
  visual.setAttribute('aria-hidden','true');visual.setAttribute('data-no-l10n','');
  title.classList.add('story-title');title.append(source,visual);
  const host=title.closest('.story-hero-copy');
  const sparks=new Set();
  let cells=[],frame=0,measureFrame=0,settleTimer=0,visible=false,closed=false,lastTime=0,lastSpark=0;
  let pointer={x:0,y:0,inside:false},previousPointer={x:0,y:0};
  let width=0,fontSize=60;
  const reduced=()=>motion.matches || root.dataset.motion==='reduced';
  const active=()=>!closed && !document.hidden && visible && !reduced();
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

  function clearSparks(){for(const spark of sparks){spark.animation.cancel();spark.node.remove();}sparks.clear();}
  function sleep(){cancelAnimationFrame(frame);frame=0;lastTime=0;pointer.inside=false;clearSparks();}
  function schedule(){if(!frame && active())frame=requestAnimationFrame(draw);}
  function measure(){
    measureFrame=0;if(closed)return;
    if(reduced()){
      sleep();title.dataset.titleMotion='reduced';visual.replaceChildren();cells=[];return;
    }
    // Hidden app panels have no usable letter rectangles. They are measured on reveal.
    if(!title.getClientRects().length){sleep();return;}
    const bounds=title.getBoundingClientRect();
    width=bounds.width;fontSize=parseFloat(getComputedStyle(title).fontSize)||60;
    if(!width)return;
    const language=root.lang || 'en';
    // Keep joining scripts shaped as complete words; Latin/Cyrillic use individual graphemes.
    const joining=/[\p{Script=Arabic}\p{Script=Devanagari}]/u.test(source.textContent);
    const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(language,{granularity:joining?'word':'grapheme'}):null;
    const walker=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);
    const next=[],fragment=document.createDocumentFragment();
    while(walker.nextNode()){
      const text=walker.currentNode;
      let offset=0;
      const segments=segmenter?segmenter.segment(text.data):Array.from(text.data,segment=>{const part={segment,index:offset};offset+=segment.length;return part;});
      for(const part of segments){
        if(!part.segment.trim())continue;
        const range=document.createRange();
        range.setStart(text,part.index);range.setEnd(text,part.index+part.segment.length);
        // A wrapping word may occupy more than one fragment. Its original text remains the fallback.
        const rects=[...range.getClientRects()].filter(rect=>rect.width>0 && rect.height>0);
        if(rects.length!==1){title.dataset.titleMotion='still';sleep();visual.replaceChildren();cells=[];return;}
        const rect=rects[0],index=next.length;
        const node=document.createElement('span');node.className='story-title-letter';node.textContent=part.segment;
        const left=rect.left-bounds.left,top=rect.top-bounds.top;
        Object.assign(node.style,{left:left+'px',top:top+'px',width:rect.width+'px',height:rect.height+'px',lineHeight:rect.height+'px'});
        fragment.append(node);
        next.push({node,left,top,width:rect.width,height:rect.height,x:0,y:0,vx:0,vy:0,angle:0,glow:-1,phase:index*1.73,speed:.72+(index%7)*.047});
      }
    }
    clearSparks();visual.replaceChildren(fragment);cells=next;
    title.dataset.titleMotion=cells.length?'active':'still';lastTime=0;schedule();
  }
  function queueMeasure(){if(!measureFrame && !closed)measureFrame=requestAnimationFrame(measure);}

  function sparkle(cell,now){
    if(sparks.size>=10 || now-lastSpark<110 || !pointer.inside)return;
    if(Math.hypot(pointer.x-previousPointer.x,pointer.y-previousPointer.y)<12)return;
    lastSpark=now;previousPointer={x:pointer.x,y:pointer.y};
    const node=document.createElement('i');node.className='story-title-spark';
    node.textContent=sparks.size%3===0?'✧':'✦';
    const x=cell.left+cell.width*(.2+Math.random()*.6),y=cell.top+cell.height*.46;
    node.style.left=x+'px';node.style.top=y+'px';node.style.fontSize=(5+Math.random()*5)+'px';
    visual.append(node);
    const drift=(Math.random()-.5)*28;
    const animation=node.animate([
      {opacity:0,transform:'translate(0,0) scale(.2) rotate(0deg)'},
      {opacity:.75,offset:.18},
      {opacity:0,transform:`translate(${drift}px,${-20-Math.random()*23}px) scale(.1) rotate(100deg)`}
    ],{duration:800+Math.random()*450,easing:'cubic-bezier(.2,.65,.3,1)'});
    const spark={node,animation};sparks.add(spark);
    const remove=()=>{node.remove();sparks.delete(spark);};animation.finished.then(remove,remove);
  }

  function draw(now){
    frame=0;if(!active())return;
    const delta=lastTime?clamp((now-lastTime)/16.667,.25,2):1;lastTime=now;
    const time=now/1000,amplitude=clamp(fontSize*.032,1.1,2.7);
    const rect=pointer.inside?title.getBoundingClientRect():null;
    const px=rect?pointer.x-rect.left:0,py=rect?pointer.y-rect.top:0;
    const radius=clamp(fontSize*2.2,100,170);
    let nearest=null,best=0;
    for(const cell of cells){
      const dx=cell.left+cell.width/2-px,dy=cell.top+cell.height*.55-py;
      const distance=Math.hypot(dx,dy);
      const influence=pointer.inside?Math.pow(Math.max(0,1-distance/radius),2):0;
      const idle=Math.sin(time*cell.speed+cell.phase);
      const push=influence*8;
      const targetX=clamp(Math.sin(time*.54+cell.phase)*amplitude*.32+dx/Math.max(distance,1)*push,-cell.left,Math.max(0,width-cell.left-cell.width));
      const targetY=idle*amplitude+dy/Math.max(distance,1)*push;
      const damp=Math.pow(.78,delta);
      cell.vx=(cell.vx+(targetX-cell.x)*.075*delta)*damp;
      cell.vy=(cell.vy+(targetY-cell.y)*.075*delta)*damp;
      cell.x+=cell.vx*delta;cell.y+=cell.vy*delta;
      const angle=idle*.45+clamp(dx/radius,-1,1)*influence*3;
      cell.angle+=(angle-cell.angle)*(1-Math.pow(.86,delta));
      cell.node.style.transform=`translate3d(${cell.x.toFixed(2)}px,${cell.y.toFixed(2)}px,0) rotate(${cell.angle.toFixed(2)}deg)`;
      const glow=Math.round((.12+(idle+1)*.055+influence*.8)*32)/32;
      if(glow!==cell.glow){
        cell.glow=glow;
        cell.node.style.textShadow=`0 0 ${2+glow*13}px rgba(255,221,157,${.1+glow*.4}),0 0 ${8+glow*25}px rgba(237,180,104,${glow*.2})`;
      }
      if(influence>best){nearest=cell;best=influence;}
    }
    if(nearest && best>.18)sparkle(nearest,now);
    schedule();
  }
  host.addEventListener('pointermove',event=>{
    if(!fine.matches || event.pointerType==='touch' || reduced())return;
    pointer={x:event.clientX,y:event.clientY,inside:true};schedule();
  },{passive:true});
  host.addEventListener('pointerleave',()=>{pointer.inside=false;});
  const visibility=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(visible){queueMeasure();schedule();}else sleep();
  },{rootMargin:'24px'});visibility.observe(title);
  const resize=new ResizeObserver(queueMeasure);resize.observe(title);
  new MutationObserver(queueMeasure).observe(source,{subtree:true,childList:true,characterData:true});
  new MutationObserver(()=>{if(reduced())measure();else queueMeasure();}).observe(root,{attributes:true,attributeFilter:['data-motion']});
  motion.addEventListener('change',measure);
  fine.addEventListener('change',()=>{pointer.inside=false;});
  addEventListener('resize',queueMeasure,{passive:true});
  addEventListener('raccoon:appchange',()=>{
    sleep();queueMeasure();clearTimeout(settleTimer);
    // The shop panel itself finishes a short entrance transform after switching tabs.
    settleTimer=setTimeout(queueMeasure,520);
  });
  addEventListener('hanzi:languagechange',()=>{sleep();queueMeasure();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)sleep();else queueMeasure();});
  document.fonts?.ready.then(queueMeasure);
  document.fonts?.addEventListener('loadingdone',queueMeasure);
  addEventListener('pagehide',()=>{closed=true;sleep();clearTimeout(settleTimer);cancelAnimationFrame(measureFrame);measureFrame=0;});
  addEventListener('pageshow',()=>{closed=false;queueMeasure();});
  measure();
})();
