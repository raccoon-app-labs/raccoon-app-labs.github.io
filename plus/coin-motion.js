/* Finite coin choreography: no animation loop, no price/count changes. */
(() => {
  'use strict';
  const root=document.documentElement,section=document.querySelector('#neon-panel #neon-coins');
  if(!section || section.dataset.coinMotionReady)return;
  const cards=[...section.querySelectorAll('.coin-card')];if(cards.length!==4)return;
  section.dataset.coinMotionReady='true';
  const media=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  let closed=false;
  const still=()=>media.matches || root.dataset.motion==='reduced';
  const allowed=()=>!closed && !document.hidden && !still() && root.dataset.app==='neon' && !root.dataset.siteScrolling && !document.querySelector('dialog[open]');
  const paths=[
    '<ellipse class="coin-halo" cx="47" cy="55" rx="34" ry="9"/><path class="coin-trace" d="M9 69H99" pathLength="1"/>',
    '<ellipse class="coin-halo" cx="57" cy="39" rx="49" ry="20" transform="rotate(-16 57 39)"/><path class="coin-trace" d="M12 51C-2 13 106 6 109 37S28 77 12 51Z" pathLength="1"/>',
    '<path class="coin-halo" d="M50 5L87 25V61L50 78L13 61V25Z"/><path class="coin-trace" d="M101 10V26H116M101 67V52H116M5 39H20" pathLength="1"/>',
    '<ellipse class="coin-halo" cx="49" cy="50" rx="35" ry="13"/><path class="coin-trace" d="M6 69H91L107 53V34L124 17H171" pathLength="1"/>'
  ];
  const kinds=['spring','orbit','vault','bank'];
  const states=cards.map((card,index)=>{
    const stage=card.querySelector('.coin-stack'),art=document.createElement('span');
    art.className='coin-choreography';art.setAttribute('aria-hidden','true');
    art.innerHTML='<svg viewBox="0 0 180 84" focusable="false">'+paths[index]+'</svg>'+Array.from({length:4},()=>'<span class="coin-spark"></span>').join('');
    stage.append(art);card.classList.add('coin-motion-ready');card.dataset.coinMotion=kinds[index];card.dataset.coinState='resting';
    const frame=document.createElement('span');frame.className='coin-frame-pulse';frame.setAttribute('aria-hidden','true');
    frame.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><path d="M5 1H95Q99 1 99 5V95Q99 99 95 99H5Q1 99 1 95V5Q1 1 5 1Z" pathLength="100"/></svg>';card.prepend(frame);
    return {card,index,stage,art,frame,coins:[...stage.querySelectorAll('i')].slice(0,index===0?2:3),visible:false,played:false,last:-Infinity,animations:[],token:0};
  });
  function stop(state){
    state.token++;const running=state.animations;state.animations=[];
    for(const animation of running)animation.cancel();
    state.card.dataset.coinState='resting';
  }
  function frames(kind,coin){
    const base=[15,-18,25][coin],sign=coin%2?-1:1,s=innerWidth<600?.68:1;
    const at=(x,y,turn=0,spin=0,scale=1)=>`translate3d(${x*s}px,${y*s}px,0) rotate(${base+turn}deg) rotateY(${spin}deg) scale(${scale})`;
    const home=at(0,0);
    if(kind===0)return [{transform:home},{transform:at(0,5,-8,0,1.08),offset:.15},{transform:at(12+coin*9,-23-coin*7,sign*20,180,.92),offset:.43},{transform:at(4,3,5,360,1.12),offset:.72},{transform:at(0,-5,-4,360),offset:.86},{transform:home}];
    if(kind===1)return [{transform:home},{transform:at(18-coin*19,-18,sign*28,90),offset:.22},{transform:at(47-coin*24,3,sign*60,210,.8),offset:.48},{transform:at(-5+coin*8,15,-sign*12,320),offset:.74},{transform:home}];
    if(kind===2)return [{transform:home},{transform:at((coin-1)*7,1,-base,0,.9),offset:.2},{transform:at((coin-1)*22,-17,sign*12,180),offset:.46},{transform:at((coin-1)*12,-5,sign*65,350),offset:.67},{transform:at(0,3,0,360,1.08),offset:.84},{transform:home}];
    return [{transform:home},{transform:at(-7,4,-9,0,.9),offset:.15},{transform:at(31+coin*9,-24-coin*3,sign*18,180),offset:.38},{transform:at(66-coin*5,-5,sign*40,320,.78),offset:.6},{transform:at(14,-2,-8,360),offset:.82},{transform:home}];
  }
  function play(state,delay=0,entrance=false){
    const now=performance.now();
    if(!allowed() || !state.visible || state.animations.length || (!entrance && now-state.last<850))return;
    state.last=now;state.card.dataset.coinState='animating';const token=++state.token;
    const duration=[1100,1550,1450,1700][state.index];
    const animate=(node,keyframes,options={})=>{const a=node.animate(keyframes,{duration,delay,easing:'cubic-bezier(.22,.68,.24,1)',...options});state.animations.push(a);};
    state.coins.forEach((coin,i)=>animate(coin,frames(state.index,i),{delay:delay+i*85}));
    animate(state.art.querySelector('.coin-halo'),[{opacity:0,transform:'scale(.65)'},{opacity:.55,transform:'scale(1)',offset:.35},{opacity:0,transform:'scale(1.4)'}]);
    animate(state.art.querySelector('.coin-trace'),[{opacity:0,strokeDashoffset:1},{opacity:.65,strokeDashoffset:0,offset:.55},{opacity:0,strokeDashoffset:-.3}]);
    state.art.querySelectorAll('.coin-spark').forEach((spark,i)=>{
      const angle=(i*75-145)*Math.PI/180,radius=26+i*7;
      animate(spark,[{opacity:0,transform:'translate(0,0) scale(.2)'},{opacity:.8,offset:.22},{opacity:0,transform:`translate(${Math.cos(angle)*radius}px,${Math.sin(angle)*radius}px) rotate(${i*70}deg) scale(.15)`}],{duration:750,delay:delay+280+i*55});
    });
    if(state.index===3)animate(state.frame,[{opacity:0},{opacity:.8,offset:.2},{opacity:0}],{duration:1600});
    if(state.index===3)animate(state.frame.querySelector('path'),[{strokeDashoffset:100},{strokeDashoffset:-100}],{duration:1600,easing:'linear'});
    const running=state.animations.slice();
    Promise.allSettled(running.map(a=>a.finished)).then(()=>{if(token!==state.token)return;state.animations=[];state.played=true;state.card.dataset.coinState='resting';});
  }
  function sync(){
    section.dataset.coinMotionState=still()?'reduced':allowed()?'ready':'paused';
    for(const state of states){if(!allowed() || !state.visible)stop(state);else if(!state.played)play(state,state.index*100,true);}
  }
  for(const state of states){
    state.card.addEventListener('pointerenter',e=>{if(fine.matches && e.pointerType!=='touch')play(state);});
    state.card.addEventListener('focusin',()=>play(state));
    state.card.addEventListener('pointerdown',e=>{if(e.pointerType==='touch' && !e.target.closest('button,a,input,select,textarea'))play(state);},{passive:true});
  }
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const state=states.find(s=>s.card===entry.target);state.visible=entry.isIntersecting && entry.intersectionRatio>=.15;}sync();},{threshold:[0,.15]});
  states.forEach(s=>observer.observe(s.card));
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-motion','data-app','class']});
  media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  addEventListener('raccoon:scrollstate',sync);addEventListener('raccoon:appchange',sync);
  addEventListener('pagehide',()=>{closed=true;sync();});addEventListener('pageshow',()=>{closed=false;sync();});sync();
})();
