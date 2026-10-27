(() => {
  'use strict';
  const root=document.documentElement;if(root.dataset.siteWorld!=='studio')return;
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
    button.addEventListener('click',()=>{if(reduced.matches)return;visual.classList.remove('is-bursting');void pulse.offsetWidth;visual.classList.add('is-bursting');burst=1;clearTimeout(burstTimer);burstTimer=setTimeout(()=>visual.classList.remove('is-bursting'),1300);schedule();});
    const labels=()=>button.setAttribute('aria-label',root.lang==='ru'?'Зажечь созвездие приложений':'Light up the app constellation');labels();new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
  }
  const sections=[...document.querySelectorAll('.showcase,.values,.project-pages')];sections.forEach(n=>n.classList.add('studio-section'));
  const reveal=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('is-awake',entry.isIntersecting);},{threshold:.12});sections.forEach(n=>reveal.observe(n));
  const canvas=document.createElement('canvas');canvas.className='studio-field';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);const ctx=canvas.getContext('2d');if(!ctx)return;
  let width=1,height=1,frame=0,last=0,time=0,burst=0,closed=false,pointer={x:-1000,y:-1000};
  const stars=Array.from({length:64},(_,i)=>({x:((i*137.51)%997)/997,y:((i*253.79)%991)/991,phase:i*2.399,size:i%7===0?2:1}));
  const colors=()=>root.dataset.theme==='light'?['103,72,156','35,131,117']:['188,165,255','133,232,205'];
  function size(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw(0);}
  function schedule(){if(!frame&&!closed&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(closed||document.hidden)return;
    if(now && now-last<32){schedule();return;}last=now;time+=reduced.matches?0:.012;burst*=.94;ctx.clearRect(0,0,width,height);
    const palette=colors(),scroll=scrollY*.025;
    const points=stars.map((s,i)=>({x:s.x*width+Math.sin(time*.4+s.phase)*18,y:(s.y*height+scroll*(i%2?1:-1)+height*20)%height,s}));
    for(let i=0;i<points.length;i++){
      const p=points[i],distance=Math.hypot(p.x-pointer.x,p.y-pointer.y),near=Math.max(0,1-distance/210),alpha=.15+Math.sin(time+p.s.phase)**2*.28+near*.45;
      ctx.fillStyle=`rgba(${palette[i%2]},${alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,p.s.size+near+burst,0,Math.PI*2);ctx.fill();
      for(let j=i+1;j<Math.min(i+6,points.length);j++){
        const q=points[j],d=Math.hypot(q.x-p.x,q.y-p.y);if(d>160)continue;
        ctx.strokeStyle=`rgba(${palette[i%2]},${(1-d/160)*(.13+near*.22)})`;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
        const travel=(time*.32+p.s.phase)%1;ctx.fillStyle=`rgba(${palette[i%2]},${.3+near*.4})`;ctx.beginPath();ctx.arc(p.x+(q.x-p.x)*travel,p.y+(q.y-p.y)*travel,1.4,0,Math.PI*2);ctx.fill();
      }
    }
    // Slow, broken contours connect the whole page without sitting over its text.
    for(let i=0;i<3;i++){
      ctx.strokeStyle=`rgba(${palette[i%2]},.075)`;ctx.lineWidth=1;ctx.beginPath();
      for(let y=-30;y<height+30;y+=12){const x=width*(.16+i*.34)+Math.sin(y/260+time*.15+i*2+scroll*.003)*width*.12;y===-30?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
    }
    schedule();
  }
  document.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};},{passive:true});root.addEventListener('pointerleave',()=>pointer={x:-1000,y:-1000});
  addEventListener('resize',size,{passive:true});addEventListener('scroll',()=>{if(reduced.matches)draw(0);},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
  reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);frame=0;draw(0);});addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);frame=0;});addEventListener('pageshow',()=>{closed=false;schedule();});size();
})();
