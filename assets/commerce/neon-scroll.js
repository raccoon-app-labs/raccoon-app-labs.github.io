/* A reversible scroll-driven rift. Only the illustrated stage moves. */
(() => {
  const panel=document.querySelector('#neon-panel');
  if(!panel)return;
  const stage=panel.querySelector('.hero-art'),hero=panel.querySelector('.hero');
  if(!stage || !hero)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const rift=document.createElement('span');rift.className='scroll-rift';rift.setAttribute('aria-hidden','true');stage.prepend(rift);
  for(let i=0;i<7;i++){const shard=document.createElement('i');shard.style.setProperty('--shard',i);rift.append(shard);}
  let frame=0,start=0,range=1;
  function disabled(){return panel.hidden || document.hidden || media.matches || document.documentElement.dataset.motion==='reduced';}
  function draw(){
    frame=0;
    const progress=disabled()?0:Math.max(0,Math.min(1,(scrollY-start)/range));
    stage.style.setProperty('--rift-progress',progress.toFixed(4));stage.dataset.riftProgress=progress.toFixed(4);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  function measure(){
    if(panel.hidden){schedule();return;}
    const reference=innerWidth<=760?stage:hero;
    let top=0;for(let node=reference;node;node=node.offsetParent)top+=node.offsetTop;
    start=top-(innerWidth<=760?innerHeight*.6:0)-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hub-nav-height'))||0);
    range=Math.max(240,Math.min(hero.offsetHeight,innerHeight)*.85);schedule();
  }
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);
  addEventListener('raccoon:appchange',measure);addEventListener('hanzi:languagechange',measure);
  document.addEventListener('visibilitychange',schedule);media.addEventListener('change',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  new ResizeObserver(measure).observe(hero);document.fonts.ready.then(measure);measure();
})();
