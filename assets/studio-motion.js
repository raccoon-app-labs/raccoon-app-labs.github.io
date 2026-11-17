(() => {
  'use strict';
  const root=document.documentElement;if(root.dataset.siteWorld!=='studio'||root.dataset.studioMotion==='ready')return;root.dataset.studioMotion='ready';
  const fine=matchMedia('(hover: hover) and (pointer: fine)'),quiet=()=>reduced.matches||root.dataset.motion==='reduced';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),visual=document.querySelector('.visual'),core=visual?.querySelector('.core');
  const worlds=[['stories','magical-stories'],['keys','hanzi-keys'],['bloom','hanzi-bloom'],['muropolis','muropolis'],['neon','neon-cyber-wall-kicker'],['food','what-to-eat'],['dokupit','dokupit']];
  if(core){
    visual.removeAttribute('aria-hidden');
    const button=document.createElement('button');button.className='studio-orbit';button.type='button';button.dataset.noL10n='';
    while(core.firstChild)button.append(core.firstChild);core.append(button);
    const rings=document.createElement('div');rings.className='studio-rings';rings.setAttribute('aria-hidden','true');
    const pulse=document.createElement('i');pulse.className='studio-pulse';pulse.setAttribute('aria-hidden','true');
    const satellites=document.createElement('div');satellites.className='studio-satellites';
    worlds.forEach(([name,slug],i)=>{
      const carrier=document.createElement('div');carrier.className='studio-satellite';const angle=(i/worlds.length*Math.PI*2)-Math.PI/2;
      carrier.style.left=50+Math.cos(angle)*45+'%';carrier.style.top=50+Math.sin(angle)*45+'%';
      const link=document.createElement('a');link.href='/apps/'+slug+'/';
      link.setAttribute('aria-label',document.querySelector('.app-card.'+name+' h3')?.textContent || name);
      const icon=document.createElement('img');icon.src=({"neon":"/assets/display/apps/neon-icon.webp?v=99747775324b"})[name] || '/assets/apps/'+name+'-icon.webp';icon.width=31;icon.height=31;icon.alt='';link.append(icon);carrier.append(link);satellites.append(carrier);
    });
    visual.append(rings,satellites,pulse);
    let burstTimer;
    button.addEventListener('click',()=>{if(quiet())return;visual.classList.remove('is-bursting');void pulse.offsetWidth;visual.classList.add('is-bursting');clearTimeout(burstTimer);burstTimer=setTimeout(()=>visual.classList.remove('is-bursting'),1300);});
    const labels=()=>button.setAttribute('aria-label',root.lang==='ru'?'Зажечь созвездие приложений':'Light up the app constellation');labels();new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
  }
  const sections=[...document.querySelectorAll('.showcase,.values,.project-pages')];sections.forEach(n=>n.classList.add('studio-section'));
  const reveal=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('is-awake',entry.isIntersecting);},{threshold:.12});sections.forEach(n=>reveal.observe(n));
  // Gradients animate through CSS transforms. JavaScript only eases a small
  // parallax offset after input, and stops as soon as that offset has settled.
  const atmosphere=document.createElement('div');atmosphere.className='studio-atmosphere';
  atmosphere.setAttribute('aria-hidden','true');atmosphere.setAttribute('inert','');atmosphere.dataset.noL10n='';
  const depth=document.createElement('div');depth.className='studio-atmosphere-depth';
  for(const color of ['violet','mint','rose']){const layer=document.createElement('span');layer.className='studio-gradient studio-gradient-'+color;depth.append(layer);}
  atmosphere.append(depth);document.body.prepend(atmosphere);
  let width=Math.max(1,innerWidth),height=Math.max(1,innerHeight),frame=0,last=0,closed=false,focused=true,x=0,y=0,targetX=0,targetY=0;
  const paused=()=>closed||!focused||document.hidden||!!root.dataset.siteScrolling||quiet();
  function paint(){depth.style.transform='translate3d('+x.toFixed(3)+'px,'+y.toFixed(3)+'px,0)';}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function schedule(){if(!frame&&!paused()&&(Math.abs(targetX-x)>.025||Math.abs(targetY-y)>.025))frame=requestAnimationFrame(tick);}
  function tick(now){
    frame=0;if(paused())return;
    const dt=last?Math.min((now-last)/1000,.05):1/60;last=now;
    const ease=1-Math.exp(-dt*9);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
    if(Math.abs(targetX-x)<=.025&&Math.abs(targetY-y)<=.025){x=targetX;y=targetY;paint();last=0;return;}
    paint();schedule();
  }
  function center(){targetX=targetY=0;schedule();}
  function activity(){
    stop();atmosphere.dataset.paused=paused()?'true':'false';
    if(quiet()){x=y=targetX=targetY=0;paint();}else if(!paused())center();
  }
  document.addEventListener('pointermove',event=>{
    if(!fine.matches||event.pointerType==='touch'||paused())return;
    targetX=Math.max(-.5,Math.min(.5,event.clientX/width-.5))*24;
    targetY=Math.max(-.5,Math.min(.5,event.clientY/height-.5))*20;schedule();
  },{passive:true});
  root.addEventListener('pointerleave',center);
  addEventListener('resize',()=>{stop();width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);x=y=targetX=targetY=0;paint();},{passive:true});
  document.addEventListener('visibilitychange',activity);addEventListener('raccoon:scrollstate',activity);
  addEventListener('blur',()=>{focused=false;activity();});addEventListener('focus',()=>{focused=true;activity();});
  addEventListener('pagehide',()=>{closed=true;activity();});addEventListener('pageshow',()=>{closed=false;activity();});
  reduced.addEventListener('change',activity);fine.addEventListener('change',center);
  new MutationObserver(activity).observe(root,{attributes:true,attributeFilter:['data-motion']});
  paint();activity();
})();
