(() => {
  'use strict';
  const root=document.documentElement;if(root.dataset.siteWorld!=='studio')return;
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
    button.addEventListener('click',()=>{if(reduced.matches)return;visual.classList.remove('is-bursting');void pulse.offsetWidth;visual.classList.add('is-bursting');burst=1;clearTimeout(burstTimer);burstTimer=setTimeout(()=>visual.classList.remove('is-bursting'),1300);schedule();});
    const labels=()=>button.setAttribute('aria-label',root.lang==='ru'?'Зажечь созвездие приложений':'Light up the app constellation');labels();new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
  }
  const sections=[...document.querySelectorAll('.showcase,.values,.project-pages')];sections.forEach(n=>n.classList.add('studio-section'));
  const reveal=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('is-awake',entry.isIntersecting);},{threshold:.12});sections.forEach(n=>reveal.observe(n));
  const canvas=document.createElement('canvas');canvas.className='studio-field';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);const ctx=canvas.getContext('2d');if(!ctx)return;
  let width=1,height=1,frame=0,last=0,time=0,burst=0,closed=false,focused=true,pointer={x:-1000,y:-1000,fx:0,fy:0,energy:0,active:false},scrollOffset=0;
  const ripples=Array.from({length:2},()=>({x:0,y:0,life:0}));let rippleIndex=0;
  const ribbons=[new Float64Array(24),new Float64Array(24)];
  const pointerColors={light:['113,66,166','29,126,119'],dark:['189,161,255','115,239,211']};
  function clearInteraction(){pointer.active=false;pointer.energy=0;for(const ripple of ripples)ripple.life=0;}
  const stars=Array.from({length:88},(_,i)=>({x:((i*137.51)%997)/997,y:((i*253.79)%991)/991,phase:i*2.399,accent:i%12===0,size:i%12===0?1.45:.75+(i%3)*.14}));
  const points=stars.map(s=>({x:0,y:0,baseX:0,baseY:0,s}));
  const lightColors=['111,99,142','87,123,117'],darkColors=['175,172,200','146,176,172'];
  const colors=()=>root.dataset.theme==='light'?lightColors:darkColors;
  let glowKey='',glows=[];
  function glowSprites(palette){
    const key=palette.join('|');if(key===glowKey)return glows;glowKey=key;
    // Bake the soft light once per palette; avoid per-star shadow blur every frame.
    glows=palette.map(color=>{
      const sprite=document.createElement('canvas');sprite.width=sprite.height=64;
      const paint=sprite.getContext('2d'),light=paint.createRadialGradient(32,32,0,32,32,32);
      light.addColorStop(0,`rgba(${color},.55)`);light.addColorStop(.18,`rgba(${color},.18)`);
      light.addColorStop(.5,`rgba(${color},.04)`);light.addColorStop(1,`rgba(${color},0)`);
      paint.fillStyle=light;paint.fillRect(0,0,64,64);return sprite;
    });return glows;
  }
  function size(){
    // This immediate resize paint replaces, rather than duplicates, our queued frame.
    cancelAnimationFrame(frame);frame=0;clearInteraction();width=innerWidth;height=innerHeight;
    for(const p of points){p.baseX=p.s.x*width;p.baseY=p.s.y*height;}
    const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw(0);
  }
  function schedule(){if(!frame&&!closed&&!document.hidden&&!root.dataset.siteScrolling&&focused&&!quiet())frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;if(closed||!focused||document.hidden||root.dataset.siteScrolling)return;
    if(now && now-last<32){schedule();return;}const dt=now&&last?Math.min((now-last)/1000,.05):now?1/30:0;last=now;time+=quiet()?0:.012;
    pointer.energy=Math.max(0,pointer.energy-dt*1.15);
    if(pointer.active){const follow=1-Math.exp(-dt*14);pointer.fx+=(pointer.x-pointer.fx)*follow;pointer.fy+=(pointer.y-pointer.fy)*follow;}
    burst*=.94;ctx.clearRect(0,0,width,height);
    scrollOffset+=(scrollY*.025-scrollOffset)*.1;
    const palette=colors(),glow=glowSprites(palette),scroll=scrollOffset,sweepX=(time*.1)%1.4-.2;
    for(let i=0;i<points.length;i++){
      const p=points[i];p.x=p.baseX+Math.sin(time*.18+p.s.phase)*10;p.y=(p.baseY+scroll*(i%2?1:-1)+height*20)%height;
      if(pointer.energy>0&&!quiet()){
        const dx=p.x-pointer.fx,dy=p.y-pointer.fy,d2=dx*dx+dy*dy;
        if(d2<32400){const force=(1-d2/32400)*pointer.energy;p.x+=(-dy*.22-dx*.1)*force;p.y+=(dx*.22-dy*.1)*force;}
      }
    }
    for(let i=0;i<points.length;i++){
      const p=points[i],pointerX=p.x-pointer.x,pointerY=p.y-pointer.y;
      // Outside this square the original circular influence is exactly zero.
      const near=pointerX>195||pointerX< -195||pointerY>195||pointerY< -195?0:Math.max(0,1-Math.hypot(pointerX,pointerY)/195);
      const twinkle=.5+.5*Math.sin(time*.7+p.s.phase),sweep=Math.exp(-(((p.x/width-sweepX)/.22)**2));
      const alpha=.29+twinkle*.1+(p.s.accent ? .08 : 0)+near*.16+sweep*.035+burst*.025;
      const radius=p.s.size+twinkle*.06+near*.25+burst*.12;
      // Mostly crisp pinpoints; only a few accents receive a restrained halo.
      if(p.s.accent||near>.45){
        const halo=4+p.s.size*1.5+near*2.7;
        ctx.globalAlpha=.12+twinkle*.04+near*.11;ctx.drawImage(glow[i%2],p.x-halo,p.y-halo,halo*2,halo*2);ctx.globalAlpha=1;
      }
      ctx.fillStyle=`rgba(${palette[i%2]},${alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
      for(let j=i+1;j<Math.min(i+6,points.length);j++){
        const q=points[j],dx=q.x-p.x,dy=q.y-p.y;
        // Keep the original distance for every visible link; reject only pairs
        // that cannot reach the 160px circle, before evaluating its square root.
        if(dx>160||dx< -160||dy>160||dy< -160)continue;
        const d=Math.hypot(dx,dy);if(d>160)continue;
        ctx.strokeStyle=`rgba(${palette[i%2]},${(1-d/160)*(.065+near*.08+sweep*.02)})`;ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
        const travel=(time*.18+p.s.phase)%1;ctx.fillStyle=`rgba(${palette[i%2]},${.22+near*.1})`;ctx.beginPath();ctx.arc(p.x+(q.x-p.x)*travel,p.y+(q.y-p.y)*travel,.8,0,Math.PI*2);ctx.fill();
      }
    }
    // Slow, broken contours connect the whole page without sitting over its text.
    for(let i=0;i<3;i++){
      ctx.strokeStyle=`rgba(${palette[i%2]},.075)`;ctx.lineWidth=1;ctx.beginPath();
      for(let y=-30;y<height+30;y+=12){const x=width*(.16+i*.34)+Math.sin(y/260+time*.15+i*2+scroll*.003)*width*.12;y===-30?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
    }
    drawInteraction(palette,glow,dt);
    schedule();
  }
  function drawInteraction(palette,glow,dt){
    if(quiet()||!fine.matches)return;
    const energy=pointer.energy,ink=root.dataset.theme==='light'?pointerColors.light:pointerColors.dark;
    if(energy>.01){
      // Two open spiral ribbons: a small magnetic eddy, never a full-screen layer.
      for(let arm=0;arm<2;arm++){
        let previousX=0,previousY=0;ctx.beginPath();
        for(let step=0;step<12;step++){
          const angle=time*2.8+step*.38+arm*Math.PI,radius=14+step*7;
          const x=pointer.fx+Math.cos(angle)*radius,y=pointer.fy+Math.sin(angle)*radius*.6;
          ribbons[arm][step*2]=x;ribbons[arm][step*2+1]=y;
          if(!step)ctx.moveTo(x,y);else ctx.quadraticCurveTo(previousX,previousY,(previousX+x)*.5,(previousY+y)*.5);
          previousX=x;previousY=y;
        }
        ctx.strokeStyle='rgba('+ink[arm]+','+(energy*.48)+')';ctx.lineWidth=.85;ctx.stroke();
        for(let step=2;step<12;step+=3){
          const x=ribbons[arm][step*2],y=ribbons[arm][step*2+1],halo=6+step*.3;
          ctx.globalAlpha=energy*.55;ctx.drawImage(glow[arm],x-halo,y-halo,halo*2,halo*2);ctx.globalAlpha=1;
          ctx.fillStyle='rgba('+ink[arm]+','+(energy*.8)+')';ctx.beginPath();ctx.arc(x,y,step%2?1.1:1.6,0,Math.PI*2);ctx.fill();
        }
      }
    }
    for(const ripple of ripples){
      if(ripple.life<=0)continue;ripple.life=Math.max(0,ripple.life-dt*1.3);const age=1-ripple.life;
      ctx.strokeStyle='rgba('+ink[1]+','+(ripple.life*.36)+')';ctx.lineWidth=.75;
      ctx.beginPath();ctx.ellipse(ripple.x,ripple.y,9+age*109,5+age*62,-.45,0,Math.PI*2);ctx.stroke();
    }
  }
  document.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;pointer.x=e.clientX;pointer.y=e.clientY;
    if(!fine.matches||quiet()||closed||!focused||document.hidden||root.dataset.siteScrolling)return;
    if(!pointer.active||pointer.energy<=.01){pointer.fx=pointer.x;pointer.fy=pointer.y;}
    pointer.active=true;pointer.energy=1;schedule();
  },{passive:true});
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||!fine.matches||quiet()||closed||!focused||document.hidden||root.dataset.siteScrolling)return;
    const ripple=ripples[rippleIndex++%ripples.length];ripple.x=e.clientX;ripple.y=e.clientY;ripple.life=1;schedule();
  },{passive:true});
  root.addEventListener('pointerleave',()=>{pointer.x=pointer.y=-1000;clearInteraction();});
  addEventListener('resize',size,{passive:true});addEventListener('scroll',()=>{if(quiet())draw(0);},{passive:true});
  function activity(){clearInteraction();if(closed||!focused||document.hidden||root.dataset.siteScrolling){cancelAnimationFrame(frame);frame=0;}else{last=0;schedule();}}
  document.addEventListener('visibilitychange',activity);addEventListener('raccoon:scrollstate',activity);
  reduced.addEventListener('change',()=>{clearInteraction();cancelAnimationFrame(frame);frame=0;draw(0);});
  fine.addEventListener('change',clearInteraction);
  new MutationObserver(()=>{clearInteraction();cancelAnimationFrame(frame);frame=0;draw(0);}).observe(root,{attributes:true,attributeFilter:['data-motion']});
  addEventListener('blur',()=>{focused=false;activity();});addEventListener('focus',()=>{focused=true;activity();});
  addEventListener('pagehide',()=>{closed=true;activity();});addEventListener('pageshow',()=>{closed=false;activity();});size();
})();
