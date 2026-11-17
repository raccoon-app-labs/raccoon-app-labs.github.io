/* A photographed-looking sky with projected depth; one bounded decorative loop. */
(() => {
  'use strict';
  const root=document.documentElement;
  if(root.dataset.siteWorld!=='studio'||root.dataset.spaceFlight)return;
  root.dataset.spaceFlight='ready';
  const host=document.querySelector('.studio-space'),nebula=host?.querySelector('.studio-space-parallax'),canvas=host?.querySelector('canvas');
  const ctx=canvas?.getContext('2d',{alpha:true});
  if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const stars=[],dust=Array.from({length:56},()=>({life:0})),ripples=Array.from({length:3},()=>({life:0}));
  let width=1,height=1,frame=0,last=0,clock=0,closed=false,focused=true,seed=7831,dustIndex=0,rippleIndex=0,boost=0;
  let offsetX=0,offsetY=0,oldX=-1,oldY=-1;
  const pointer={x:-1000,y:-1000,active:false,energy:0};
  const palette={dark:['#d8e5ff','#b5c4ff','#a2eee9','#fff1d0'],light:['#3f427c','#694789','#2d7379','#876a47']};
  let inks=palette.dark,sprites=[];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const quiet=()=>reduced.matches||root.dataset.motion==='reduced';
  const stopped=()=>closed||!focused||document.hidden||!!root.dataset.siteScrolling;
  function resetStar(star,initial=false){
    const angle=random()*Math.PI*2,radius=.06+random()*1.32;
    star.x=Math.cos(angle)*radius;star.y=Math.sin(angle)*radius;
    star.z=initial?.16+random()*1.65:1.75+random()*.16;
    star.size=.3+random()*.75;star.color=Math.floor(random()*4);star.phase=random()*Math.PI*2;
  }
  function makeSprites(){
    inks=root.dataset.theme==='light'?palette.light:palette.dark;
    sprites=inks.map(ink=>{
      const sprite=document.createElement('canvas');sprite.width=sprite.height=48;
      const paint=sprite.getContext('2d'),gradient=paint.createRadialGradient(24,24,0,24,24,24);
      gradient.addColorStop(0,ink);gradient.addColorStop(.1,ink+'ad');gradient.addColorStop(.36,ink+'26');gradient.addColorStop(1,ink+'00');
      paint.fillStyle=gradient;paint.fillRect(0,0,48,48);return sprite;
    });
  }
  function clearPointer(){
    pointer.active=false;pointer.energy=0;oldX=oldY=-1;
    for(const particle of dust)particle.life=0;
    for(const ripple of ripples)ripple.life=0;
  }
  function settleCamera(){offsetX=offsetY=0;if(nebula)nebula.style.transform='translate3d(0,0,0)';}
  function halt(){cancelAnimationFrame(frame);frame=0;last=0;}
  function schedule(){if(!frame&&!stopped()&&!quiet())frame=requestAnimationFrame(draw);}
  function halo(x,y,radius,color,alpha){ctx.globalAlpha=alpha;ctx.drawImage(sprites[color],x-radius,y-radius,radius*2,radius*2);}
  function render(dt){
    ctx.clearRect(0,0,width,height);
    clock+=dt;boost=Math.max(0,boost-dt*1.1);pointer.energy=Math.max(0,pointer.energy-dt*1.8);
    const follow=1-Math.exp(-dt*3),targetX=pointer.active?(pointer.x/width-.5)*20:0,targetY=pointer.active?(pointer.y/height-.5)*14:0;
    offsetX+=(targetX-offsetX)*follow;offsetY+=(targetY-offsetY)*follow;
    if(nebula)nebula.style.transform=`translate3d(${(-offsetX*.6).toFixed(2)}px,${(-offsetY*.6).toFixed(2)}px,0)`;
    const cx=width*.57+offsetX,cy=height*.44+offsetY,focal=Math.max(width,height)*.55;
    const speed=.082+boost*.16;
    for(const star of stars){
      const before=star.z;star.z-=dt*speed;
      if(star.z<.14){resetStar(star);continue;}
      let x=cx+star.x*focal/star.z,y=cy+star.y*focal/star.z;
      if(x< -45||x>width+45||y< -45||y>height+45){resetStar(star);continue;}
      const dx=x-pointer.x,dy=y-pointer.y,distance2=dx*dx+dy*dy;
      // Small local gravitational wake, with no pairwise particle comparisons.
      if(pointer.active&&distance2<22500){const force=(1-distance2/22500)*pointer.energy;x+=dy*.14*force;y-=dx*.14*force;}
      const depth=Math.max(0,1-star.z/1.9),alpha=.22+depth*.5+Math.sin(clock*.6+star.phase)*.06,radius=Math.min(2.1,star.size*(.5+depth));
      if(star.z<.65&&dt>0){
        const tailZ=star.z+Math.min(.065,Math.max(.012,before-star.z)*2.2);
        const tx=cx+star.x*focal/tailZ,ty=cy+star.y*focal/tailZ;
        const tailX=tx-x,tailY=ty-y,length=Math.sqrt(tailX*tailX+tailY*tailY),limit=Math.min(1,20/(length||1));
        ctx.globalAlpha=alpha*.42;ctx.strokeStyle=inks[star.color];ctx.lineWidth=Math.max(.5,radius*.65);
        ctx.beginPath();ctx.moveTo(x+tailX*limit,y+tailY*limit);ctx.lineTo(x,y);ctx.stroke();
      }
      if(star.size>.87&&star.z<.85)halo(x,y,radius*6,star.color,alpha*.32);
      ctx.globalAlpha=alpha;ctx.fillStyle=inks[star.color];ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    if(pointer.active&&dt>0&&!quiet()){
      const dx=oldX<0?0:pointer.x-oldX,dy=oldY<0?0:pointer.y-oldY,distance=Math.sqrt(dx*dx+dy*dy),count=Math.min(5,Math.floor(distance/5));
      if(count>0){
        for(let i=0;i<count;i++){
          const particle=dust[dustIndex++%dust.length],fraction=(i+1)/count;
          particle.x=oldX+dx*fraction;particle.y=oldY+dy*fraction;particle.vx=-dx*.65+(random()-.5)*22;particle.vy=-dy*.65+(random()-.5)*22;
          particle.life=particle.max=.5+random()*.45;particle.size=1+random()*1.4;particle.color=dustIndex%3;
        }
      }
      oldX=pointer.x;oldY=pointer.y;
    }
    for(const particle of dust){
      if(particle.life<=0)continue;particle.life=Math.max(0,particle.life-dt);particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;
      const life=particle.life/particle.max;halo(particle.x,particle.y,particle.size*7,particle.color,life*.5);
      ctx.globalAlpha=life*.85;ctx.fillStyle=inks[particle.color];ctx.fillRect(particle.x-.7,particle.y-.7,1.4,1.4);
    }
    // Two incomplete orbital arcs make the pointer feel like a little gravity well.
    if(pointer.active&&pointer.energy>.015&&!quiet()){
      const energy=pointer.energy,r=18+energy*8,angle=clock*.9;
      halo(pointer.x,pointer.y,47,2,energy*.13);
      ctx.globalAlpha=energy*.48;ctx.lineWidth=.75;ctx.strokeStyle=inks[2];
      ctx.beginPath();ctx.ellipse(pointer.x,pointer.y,r,r*.36,-.5,angle,angle+Math.PI*1.2);ctx.stroke();
      ctx.strokeStyle=inks[1];ctx.beginPath();ctx.ellipse(pointer.x,pointer.y,r*.8,r*.37,.8,-angle,-angle+Math.PI);ctx.stroke();
      const sx=pointer.x+Math.cos(angle)*r,sy=pointer.y+Math.sin(angle)*r*.36;halo(sx,sy,5,2,energy*.6);
    }
    for(const ripple of ripples){
      if(ripple.life<=0)continue;ripple.life=Math.max(0,ripple.life-dt);const t=1-ripple.life;
      ctx.globalAlpha=ripple.life*.45;ctx.strokeStyle=inks[2];ctx.lineWidth=.8;
      ctx.beginPath();ctx.ellipse(ripple.x,ripple.y,8+t*112,5+t*58,-.3,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=ripple.life*.22;ctx.beginPath();ctx.ellipse(ripple.x,ripple.y,7+t*85,7+t*85,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  function draw(now){
    frame=0;if(stopped()||quiet())return;
    if(last&&now-last<32){schedule();return;}
    const dt=last?Math.min((now-last)/1000,.05):1/30;last=now;render(dt);schedule();
  }
  function resize(){
    halt();width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);
    // Bound backing pixels even on very large/high-DPI displays.
    const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2400000/(width*height)));
    canvas.width=Math.max(1,Math.floor(width*ratio));canvas.height=Math.max(1,Math.floor(height*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);
    const count=Math.min(190,Math.max(90,Math.round(width*height/7000)));
    while(stars.length<count){const star={};resetStar(star,true);stars.push(star);}stars.length=count;
    clearPointer();settleCamera();render(0);schedule();
  }
  function activity(){
    halt();clearPointer();settleCamera();host.dataset.paused=stopped()||quiet()?'true':'false';
    if(!document.hidden&&!closed)render(0);schedule();
  }
  document.addEventListener('pointermove',event=>{
    if(!fine.matches||event.pointerType==='touch'||quiet()||stopped())return;
    if(!pointer.active){oldX=event.clientX;oldY=event.clientY;}
    pointer.x=event.clientX;pointer.y=event.clientY;pointer.active=true;pointer.energy=1;
  },{passive:true});
  root.addEventListener('pointerleave',clearPointer);
  document.addEventListener('pointerdown',event=>{
    if(!fine.matches||event.pointerType==='touch'||quiet()||stopped())return;
    const ripple=ripples[rippleIndex++%ripples.length];ripple.x=event.clientX;ripple.y=event.clientY;ripple.life=1;
  },{passive:true});
  addEventListener('studio:burst',()=>{if(!quiet()&&!stopped())boost=1;});
  addEventListener('resize',resize,{passive:true});
  addEventListener('raccoon:scrollstate',activity);
  document.addEventListener('visibilitychange',activity);
  addEventListener('blur',()=>{focused=false;activity();});addEventListener('focus',()=>{focused=true;activity();});
  addEventListener('pagehide',()=>{closed=true;activity();});addEventListener('pageshow',()=>{closed=false;activity();});
  reduced.addEventListener('change',activity);fine.addEventListener('change',activity);
  new MutationObserver(records=>{
    if(records.some(record=>record.attributeName==='data-theme'))makeSprites();
    activity();
  }).observe(root,{attributes:true,attributeFilter:['data-theme','data-motion']});
  makeSprites();resize();
})();
