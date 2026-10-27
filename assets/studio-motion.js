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
  const stars=Array.from({length:96},(_,i)=>({x:((i*137.51)%997)/997,y:((i*253.79)%991)/991,phase:i*2.399,size:i%9===0?2.7:1.5+(i%3)*.2}));
  const colors=()=>root.dataset.theme==='light'?['103,72,156','35,131,117']:['216,195,255','155,255,220'];
  let glowKey='',glows=[];
  function glowSprites(palette){
    const key=palette.join('|');if(key===glowKey)return glows;glowKey=key;
    // Bake the soft light once per palette; avoid per-star shadow blur every frame.
    glows=palette.map(color=>{
      const sprite=document.createElement('canvas');sprite.width=sprite.height=64;
      const paint=sprite.getContext('2d'),light=paint.createRadialGradient(32,32,0,32,32,32);
      light.addColorStop(0,`rgba(${color},.9)`);light.addColorStop(.18,`rgba(${color},.38)`);
      light.addColorStop(.5,`rgba(${color},.12)`);light.addColorStop(1,`rgba(${color},0)`);
      paint.fillStyle=light;paint.fillRect(0,0,64,64);return sprite;
    });return glows;
  }
  function size(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw(0);}
  function schedule(){if(!frame&&!closed&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(closed||document.hidden)return;
    if(now && now-last<32){schedule();return;}last=now;time+=reduced.matches?0:.012;burst*=.94;ctx.clearRect(0,0,width,height);
    const palette=colors(),glow=glowSprites(palette),scroll=scrollY*.025,sweepX=(time*.22)%1.4-.2;
    const points=stars.map((s,i)=>({x:s.x*width+Math.sin(time*.4+s.phase)*18,y:(s.y*height+scroll*(i%2?1:-1)+height*20)%height,s}));
    for(let i=0;i<points.length;i++){
      const p=points[i],distance=Math.hypot(p.x-pointer.x,p.y-pointer.y),near=Math.max(0,1-distance/270);
      const twinkle=(.5+.5*Math.sin(time*1.7+p.s.phase))**2,sweep=Math.exp(-(((p.x/width-sweepX)/.11)**2));
      const alpha=Math.min(1,.44+twinkle*.4+near*.35+sweep*.25),radius=p.s.size+twinkle*.55+near*.9+burst*.7+sweep*.45;
      const halo=10+p.s.size*3+near*11+burst*8+sweep*5;
      ctx.globalAlpha=Math.min(1,.38+twinkle*.32+near*.4+sweep*.25);ctx.drawImage(glow[i%2],p.x-halo,p.y-halo,halo*2,halo*2);ctx.globalAlpha=1;
      ctx.fillStyle=`rgba(${palette[i%2]},${alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
      if(i%9===0&&twinkle>.65){
        const reach=radius+3+(twinkle-.65)*9;ctx.strokeStyle=`rgba(${palette[i%2]},${(twinkle-.65)*1.5})`;ctx.lineWidth=.8;
        ctx.beginPath();ctx.moveTo(p.x-reach,p.y);ctx.lineTo(p.x+reach,p.y);ctx.moveTo(p.x,p.y-reach);ctx.lineTo(p.x,p.y+reach);ctx.stroke();
      }
      for(let j=i+1;j<Math.min(i+6,points.length);j++){
        const q=points[j],d=Math.hypot(q.x-p.x,q.y-p.y);if(d>160)continue;
        ctx.strokeStyle=`rgba(${palette[i%2]},${(1-d/160)*(.18+near*.28+sweep*.1)})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
        const travel=(time*.32+p.s.phase)%1;ctx.fillStyle=`rgba(${palette[i%2]},${Math.min(1,.55+near*.4+sweep*.2)})`;ctx.beginPath();ctx.arc(p.x+(q.x-p.x)*travel,p.y+(q.y-p.y)*travel,1.9,0,Math.PI*2);ctx.fill();
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
