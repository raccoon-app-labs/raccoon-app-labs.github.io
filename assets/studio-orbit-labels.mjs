// One readable signal at a time; the existing scene owns all projected motion.
export function captionLayout(x,y,width,height,labelWidth,labelHeight,viewportTop=-Infinity,viewportBottom=Infinity){
  const left=Math.max(6,Math.min(width-labelWidth-6,width/2+x-labelWidth/2));
  let top=y<0?-labelHeight-16:height+16;
  const alternative=y<0?height+16:-labelHeight-16;
  if((top<viewportTop||top+labelHeight>viewportBottom)&&alternative>=viewportTop&&alternative+labelHeight<=viewportBottom)top=alternative;
  const anchorX=width/2+x,anchorY=height/2+y;
  const endX=Math.max(left+18,Math.min(left+labelWidth-18,anchorX));
  const endY=top<0?top+labelHeight+5:top-5;
  return {left,top,anchorX,anchorY,length:Math.hypot(endX-anchorX,endY-anchorY),angle:Math.atan2(endY-anchorY,endX-anchorX)*180/Math.PI};
}

export function createOrbitCaptions(visual){
  const root=document.documentElement,carriers=[...visual.querySelectorAll('.studio-satellite')];
  if(carriers.length!==7)return;
  const names=['Magical Stories','Hanzi Keys','Hanzi Bloom','Muropolis','Neon Cyber Wall Kicker','What Shall We Eat?','Dokupit'];
  const effects=['story','keys','bloom','city','neon','food','list'];
  const colors=['#f4d28c','#f19bad','#baabff','#ffbe8d','#8ef3d0','#edc589','#f5ab94'];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const caption=document.createElement('div');caption.className='studio-caption';caption.dataset.noL10n='';caption.setAttribute('aria-hidden','true');
  const signal=document.createElement('div');signal.className='studio-caption-signal';signal.innerHTML='<i></i><i></i><i></i>';
  const number=document.createElement('span');number.className='studio-caption-number';
  const title=document.createElement('span');title.className='studio-caption-title';title.dir='auto';
  const arrow=document.createElement('span');arrow.className='studio-caption-arrow';arrow.textContent='↗';
  caption.append(signal,number,title,arrow);
  const tether=document.createElement('i');tether.className='studio-caption-tether';tether.setAttribute('aria-hidden','true');
  visual.append(tether,caption);visual.dataset.orbitCaptions='ready';
  let active=2,hovered=-1,focused=-1,timer=0,visible=false,closed=false,width=1,height=1,labelWidth=1,labelHeight=1,documentTop=0;
  caption.style.visibility='hidden';
  const styles=new Map();
  function style(node,key,value){const cacheKey=(node===caption?'caption:':'tether:')+key;if(styles.get(cacheKey)!==value){node.style[key]=value;styles.set(cacheKey,value);}}
  const poses=new Map(),links=carriers.map(el=>el.querySelector('a'));
  const quiet=()=>reduced.matches||root.dataset.motion==='reduced';
  const translated=(i)=>window.HanziLocale?.t(names[i])||document.querySelector('.app-card.'+['stories','keys','bloom','muropolis','neon','food','dokupit'][i]+' h3')?.textContent.replace(/\s+/g,' ').trim()||names[i];
  function place(){
    const pose=poses.get(active);
    // The bitmap fallback gets the same readable rail without tracking a CSS orbit.
    const sceneTop=documentTop-scrollY;
    const p=pose?captionLayout(pose.x,pose.y,width,height,labelWidth,labelHeight,8-sceneTop,innerHeight-8-sceneTop):captionLayout(0,height/2,width,height,labelWidth,labelHeight);
    style(caption,'left',p.left.toFixed(2)+'px');style(caption,'top',p.top.toFixed(2)+'px');
    tether.hidden=!pose||!visible;
    if(pose){style(tether,'left',p.anchorX.toFixed(2)+'px');style(tether,'top',p.anchorY.toFixed(2)+'px');style(tether,'width',p.length.toFixed(2)+'px');style(tether,'transform','rotate('+p.angle.toFixed(2)+'deg)');}
  }
  function measure(){
    const rect=visual.getBoundingClientRect();width=rect.width;height=rect.height;documentTop=rect.top+scrollY;
    caption.style.maxWidth=Math.max(120,Math.min(208,width-12))+'px';
    labelWidth=caption.offsetWidth;labelHeight=caption.offsetHeight;place();
  }
  function words(name){
    title.replaceChildren();let index=0;
    // Keep cursive and combining scripts intact rather than breaking their shaping.
    if(!/^[\p{Script=Latin}\p{Script=Cyrillic}\p{Number}\p{Punctuation}\p{Separator}]+$/u.test(name)){title.textContent=name;return;}
    for(const [i,word] of name.split(' ').entries()){
      if(i)title.append(document.createTextNode(' '));
      const group=document.createElement('span');group.className='studio-caption-word';
      for(const letter of word){const glyph=document.createElement('span');glyph.className='studio-caption-letter';glyph.textContent=letter;glyph.style.setProperty('--glyph',index++);group.append(glyph);}
      title.append(group);
    }
  }
  function show(index){
    active=index;carriers.forEach((el,i)=>el.toggleAttribute('data-caption-active',i===active));
    const name=translated(active);words(name);number.textContent=String(active+1).padStart(2,'0')+' / 07';
    caption.dataset.effect=effects[active];caption.style.setProperty('--signal-color',colors[active]);tether.style.setProperty('--signal-color',colors[active]);
    caption.classList.remove('is-revealing');measure();
    // One layout at selection time restarts a finite reveal, never in the frame loop.
    if(!quiet()){void caption.offsetWidth;caption.classList.add('is-revealing');}
  }
  function schedule(){
    clearTimeout(timer);timer=0;
    if(closed||!visible||document.hidden||quiet()||root.dataset.siteScrolling||hovered>=0||focused>=0)return;
    timer=setTimeout(()=>{show((active+1)%carriers.length);schedule();},4200);
  }
  const indexOf=node=>{const carrier=node?.closest?.('.studio-satellite');return carriers.indexOf(carrier);};
  visual.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const index=indexOf(event.target);if(index<0||index===hovered)return;hovered=index;if(focused<0)show(index);schedule();});
  visual.addEventListener('pointerout',event=>{if(event.pointerType==='touch'||indexOf(event.target)<0||indexOf(event.relatedTarget)===hovered)return;hovered=indexOf(event.relatedTarget);if(focused>=0)show(focused);else if(hovered>=0)show(hovered);schedule();});
  visual.addEventListener('focusin',event=>{focused=indexOf(event.target);if(focused>=0)show(focused);schedule();});
  visual.addEventListener('focusout',event=>{focused=indexOf(event.relatedTarget);if(focused>=0)show(focused);else if(hovered>=0)show(hovered);schedule();});
  visual.addEventListener('click',event=>{if(event.target.closest('.studio-orbit')){show((active+1)%carriers.length);schedule();}});
  function language(){links.forEach((link,i)=>link.setAttribute('aria-label',translated(i)));show(active);}
  window.addEventListener('hanzi:languagechange',language);
  const settings=new MutationObserver(()=>{language();schedule();});settings.observe(root,{attributes:true,attributeFilter:['lang','data-motion']});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;caption.style.visibility=visible?'':'hidden';place();schedule();},{threshold:0});observer.observe(visual);
  const resize=new ResizeObserver(measure);resize.observe(visual);
  document.addEventListener('visibilitychange',schedule);window.addEventListener('raccoon:scrollstate',()=>{place();schedule();});
  reduced.addEventListener('change',()=>{caption.classList.remove('is-revealing');schedule();});
  window.addEventListener('pagehide',()=>{closed=true;schedule();});window.addEventListener('pageshow',()=>{closed=false;measure();schedule();});
  document.fonts?.ready.then(measure).catch(()=>{});
  const controller={project(index,x,y){const pose=poses.get(index);if(pose){pose.x=x;pose.y=y;}else poses.set(index,{x,y});if(index===active)place();},fallback(){poses.clear();place();},resize:measure};
  visual.orbitCaption=controller;language();schedule();return controller;
}

if(typeof document!=='undefined'){
  const visual=document.documentElement.dataset.siteWorld==='studio'?document.querySelector('.visual'):null;
  if(visual)createOrbitCaptions(visual);
}
