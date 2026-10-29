/* Three finite illustrated steps; the explanatory text never moves. */
(() => {
  'use strict';
  const root=document.documentElement,section=document.querySelector('#neon-panel #neon-how-to-buy');
  if(!section || section.dataset.stepMotionReady)return;
  const cards=[...section.querySelectorAll('.steps>li')];if(cards.length!==3)return;
  section.dataset.stepMotionReady='true';
  const media=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  let closed=false;
  const still=()=>media.matches || root.dataset.motion==='reduced';
  const allowed=()=>!closed && !document.hidden && !still() && root.dataset.app==='neon' && !root.dataset.siteScrolling && !document.querySelector('dialog[open]');
  const art=[
    '<g class="step-options"><rect x="10" y="17" width="20" height="29" rx="4"/><rect x="36" y="17" width="20" height="29" rx="4"/><rect x="62" y="17" width="20" height="29" rx="4"/></g><rect class="step-selector" x="33" y="14" width="26" height="35" rx="6"/><path class="step-trace" pathLength="1" d="M41 30L45 34L51 26"/>',
    '<path class="step-options" d="M10 44H30L45 28H67"/><path class="step-trace" pathLength="1" d="M10 44H30L45 28H67"/><circle class="step-dot" cx="10" cy="44" r="3"/><path class="step-shield" d="M75 9L89 15V29Q87 39 75 45Q63 39 61 29V15Z"/><path class="step-check" pathLength="1" d="M69 25L74 30L82 20"/>',
    '<circle class="step-ring" cx="51" cy="31" r="23"/><path class="step-star" d="M51 10L57 24L73 25L61 35L65 50L51 42L37 50L41 35L29 25L45 24Z"/><g class="step-satellites"><circle cx="15" cy="15" r="4"/><circle cx="86" cy="14" r="3"/><path d="M86 43v9M82 47h9"/></g>'
  ];
  const kinds=['select','transfer','reward'];
  const states=cards.map((card,index)=>{
    const badge=card.querySelector(':scope>span'),emblem=document.createElement('div'),beacon=document.createElement('div');
    emblem.className='step-emblem';emblem.setAttribute('aria-hidden','true');emblem.innerHTML='<svg viewBox="0 0 100 60" focusable="false">'+art[index]+'</svg>';
    beacon.className='step-beacon';beacon.setAttribute('aria-hidden','true');card.append(emblem,beacon);
    card.classList.add('step-motion-ready');card.dataset.stepMotion=kinds[index];card.dataset.stepState='resting';
    return {card,badge,emblem,beacon,index,visible:false,played:false,last:-Infinity,animations:[],token:0};
  });
  function stop(state){state.token++;const running=state.animations;state.animations=[];for(const a of running)a.cancel();state.card.dataset.stepState='resting';}
  function play(state,delay=0,entrance=false){
    const now=performance.now();if(!allowed() || !state.visible || state.animations.length || (!entrance && now-state.last<900))return;
    state.last=now;state.card.dataset.stepState='animating';const token=++state.token,duration=[1400,1600,1700][state.index];
    const animate=(node,frames,options={})=>{if(!node)return;state.animations.push(node.animate(frames,{duration,delay,easing:'cubic-bezier(.22,.68,.24,1)',...options}));};
    animate(state.emblem,[{opacity:.22},{opacity:.95,offset:.35},{opacity:.22}]);
    animate(state.beacon,[{opacity:0,transform:'scale(.985)'},{opacity:.65,transform:'scale(1)',offset:.35},{opacity:0,transform:'scale(1)'}]);
    if(state.index===0){
      animate(state.badge,[{transform:'scale(1)'},{transform:'scale(.92) rotate(-6deg)',offset:.22},{transform:'scale(1.12) rotate(4deg)',offset:.5},{transform:'scale(1)'}]);
      animate(state.emblem.querySelector('.step-selector'),[{transform:'translateX(-26px)'},{transform:'translateX(0)',offset:.3},{transform:'translateX(26px)',offset:.58},{transform:'translateX(0)'}]);
      animate(state.emblem.querySelector('.step-trace'),[{strokeDashoffset:1,opacity:0},{strokeDashoffset:1,opacity:0,offset:.66},{strokeDashoffset:0,opacity:1}]);
    }else if(state.index===1){
      animate(state.badge,[{transform:'perspective(300px) rotateY(0)'},{transform:'perspective(300px) rotateY(360deg)'}]);
      animate(state.emblem.querySelector('.step-trace'),[{strokeDashoffset:1,opacity:0},{strokeDashoffset:0,opacity:1,offset:.68},{strokeDashoffset:0,opacity:0}]);
      animate(state.emblem.querySelector('.step-dot'),[{transform:'translate(0,0)',opacity:0},{transform:'translate(20px,0)',opacity:1,offset:.3},{transform:'translate(35px,-16px)',opacity:1,offset:.5},{transform:'translate(57px,-16px)',opacity:0,offset:.75},{transform:'translate(57px,-16px)',opacity:0}],{easing:'linear'});
      animate(state.emblem.querySelector('.step-check'),[{strokeDashoffset:1,opacity:0},{strokeDashoffset:1,opacity:0,offset:.5},{strokeDashoffset:0,opacity:1,offset:.85},{strokeDashoffset:0,opacity:.5}]);
    }else{
      animate(state.badge,[{transform:'translateY(0)'},{transform:'translateY(-5px) scale(1.08)',offset:.35},{transform:'translateY(2px)',offset:.65},{transform:'translateY(0)'}]);
      animate(state.emblem.querySelector('.step-star'),[{transform:'scale(.6) rotate(-30deg)'},{transform:'scale(1.18) rotate(8deg)',offset:.38},{transform:'scale(.94) rotate(-3deg)',offset:.7},{transform:'scale(1) rotate(0)'}]);
      animate(state.emblem.querySelector('.step-ring'),[{opacity:0,transform:'scale(.55)'},{opacity:.7,transform:'scale(1)',offset:.35},{opacity:0,transform:'scale(1.6)'}]);
      animate(state.emblem.querySelector('.step-satellites'),[{opacity:0,transform:'scale(.4)'},{opacity:1,transform:'scale(1.15)',offset:.45},{opacity:.2,transform:'scale(1)'}]);
    }
    const running=state.animations.slice();Promise.allSettled(running.map(a=>a.finished)).then(()=>{if(token!==state.token)return;state.animations=[];state.played=true;state.card.dataset.stepState='resting';});
  }
  function sync(){section.dataset.stepMotionState=still()?'reduced':allowed()?'ready':'paused';for(const state of states){if(!allowed() || !state.visible)stop(state);else if(!state.played)play(state,state.index*140,true);}}
  for(const state of states){
    state.card.addEventListener('pointerenter',e=>{if(fine.matches && e.pointerType!=='touch')play(state);});
    state.card.addEventListener('focusin',()=>play(state));
    state.card.addEventListener('pointerdown',e=>{if(e.pointerType==='touch' && !e.target.closest('button,a,input,select,textarea'))play(state);},{passive:true});
  }
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const state=states.find(s=>s.card===entry.target);state.visible=entry.isIntersecting && entry.intersectionRatio>=.15;}sync();},{threshold:[0,.15]});states.forEach(s=>observer.observe(s.card));
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-motion','data-app','class']});media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  addEventListener('raccoon:scrollstate',sync);addEventListener('raccoon:appchange',sync);addEventListener('pagehide',()=>{closed=true;sync();});addEventListener('pageshow',()=>{closed=false;sync();});sync();
})();
