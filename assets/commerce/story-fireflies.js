/* A short-lived, bounded swarm. No custom cursor, hit targets, network or idle loop. */
(() => {
  'use strict';
  if(document.querySelector('.story-firefly-trail'))return;
  const root=document.documentElement;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const canvas=document.createElement('canvas');
  canvas.className='story-firefly-trail';canvas.hidden=true;
  canvas.setAttribute('aria-hidden','true');canvas.setAttribute('inert','');canvas.dataset.noL10n='';
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;
  document.body.append(canvas);
  const palettes=[[[255,208,116],[186,244,197],[218,194,255]],[[191,132,42],[80,155,105],[145,105,190]]];
  const sprites=palettes.map((palette,mode)=>palette.map(rgb=>{
    const sprite=document.createElement('canvas');sprite.width=sprite.height=64;
    const paint=sprite.getContext('2d');
    const glow=paint.createRadialGradient(32,32,0,32,32,30);
    glow.addColorStop(0,mode?`rgba(${rgb.join(',')},.95)`:'rgba(255,252,222,.95)');
    glow.addColorStop(.08,`rgba(${rgb.join(',')},.75)`);
    glow.addColorStop(.23,`rgba(${rgb.join(',')},.22)`);
    glow.addColorStop(.55,`rgba(${rgb.join(',')},.055)`);
    glow.addColorStop(1,`rgba(${rgb.join(',')},0)`);
    paint.fillStyle=glow;paint.fillRect(0,0,64,64);return sprite;
  }));
  const MAX=72,SPACING=11;
  let particles=[],frame=0,lastTime=0,width=0,height=0,dirtyRect=null;
  let point=null,previous=null,carry=0,enabled=false,closed=false,lastCount=-1,night=true;
  const isStories=()=>root.dataset.app==='stories' || root.dataset.paymentAtmosphere==='stories';
  function field(node){
    const control=node?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    return control && (control.tagName!=='INPUT' || !['checkbox','radio','button','submit','reset','range','color','file'].includes(control.type));
  }
  function count(){if(lastCount!==particles.length){lastCount=particles.length;canvas.dataset.activeCount=String(lastCount);}}
  function erase(){
    if(!dirtyRect)return;
    ctx.clearRect(dirtyRect.left,dirtyRect.top,dirtyRect.right-dirtyRect.left,dirtyRect.bottom-dirtyRect.top);dirtyRect=null;
  }
  function clear(){
    cancelAnimationFrame(frame);frame=0;lastTime=0;
    particles=[];point=null;previous=null;carry=0;
    erase();count();
    canvas.dataset.state=enabled?'idle':'paused';
  }
  function resize(){
    clear();width=root.clientWidth;height=innerHeight;
    const ratio=Math.min(devicePixelRatio || 1,1.75);
    canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  function sync(){
    const nextNight=root.dataset.theme==='dark' || (!root.dataset.theme && !root.hasAttribute('data-site-theme'));
    if(night!==nextNight){night=nextNight;clear();}
    canvas.dataset.palette=night?'night':'day';
    enabled=!closed && !document.hidden && isStories() && fine.matches && !reduced.matches &&
      root.dataset.motion!=='reduced' && navigator.connection?.saveData!==true &&
      !document.querySelector('dialog[open]') && !field(document.activeElement);
    canvas.hidden=!enabled;
    if(!enabled)clear();
    else if(canvas.dataset.state==='paused')canvas.dataset.state='idle';
  }
  function schedule(){if(!frame && enabled)frame=requestAnimationFrame(draw);}
  function spawn(x,y,vx,vy){
    const pick=Math.random(),color=pick<.76?0:pick<.94?1:2;
    if(particles.length>=MAX)particles.shift();
    particles.push({x:x+(Math.random()-.5)*5,y:y+(Math.random()-.5)*5,
      vx:vx*.09+(Math.random()-.5)*15,vy:vy*.06-7-Math.random()*7,
      age:0,life:1.65+Math.random()*1.1,size:.7+Math.random()*.55,
      phase:Math.random()*Math.PI*2,frequency:.9+Math.random()*.8,color,
      angle:(Math.random()-.5)*1.2});
  }
  function emit(){
    if(!point)return;
    if(!previous){
      previous=point;spawn(point.x,point.y,0,0);point=null;return;
    }
    const dx=point.x-previous.x,dy=point.y-previous.y,distance=Math.hypot(dx,dy);
    if(distance>0){
      // Sampling by distance keeps a slow pointer delicate and a quick sweep continuous.
      const spacing=Math.max(SPACING,distance/12);
      carry%=spacing;
      for(let traveled=spacing-carry;traveled<=distance;traveled+=spacing){
        const progress=traveled/distance;
        spawn(previous.x+dx*progress,previous.y+dy*progress,dx,dy);
      }
      carry=(carry+distance)%spacing;
      previous=point;
    }
    point=null;
  }
  function draw(now){
    frame=0;if(!enabled)return;
    const dt=lastTime?Math.min((now-lastTime)/1000,.04):1/60;lastTime=now;
    emit();erase();ctx.globalCompositeOperation=night?'lighter':'source-over';
    const time=now/1000;let left=width,right=0,top=height,bottom=0;
    for(let index=particles.length-1;index>=0;index--){
      const fly=particles[index];fly.age+=dt;
      if(fly.age>=fly.life){particles.splice(index,1);continue;}
      const t=fly.age/fly.life,wave=time*fly.frequency+fly.phase;
      fly.x+=(fly.vx+Math.sin(wave*2.1)*8)*dt;
      fly.y+=(fly.vy+Math.cos(wave*1.7)*5)*dt;
      fly.vx*=Math.exp(-dt*.9);fly.vy-=dt*1.6;
      const pulse=.5+.5*Math.pow(Math.sin(wave*3),2);
      const opacity=Math.min(1,fly.age/.085)*Math.pow(1-t,1.25)*pulse;
      const halo=(32+Math.sin(wave)*4)*fly.size;
      const radius=halo/2+2;
      left=Math.min(left,fly.x-radius);right=Math.max(right,fly.x+radius);
      top=Math.min(top,fly.y-radius);bottom=Math.max(bottom,fly.y+radius);
      ctx.globalAlpha=opacity*.85;
      ctx.drawImage(sprites[night?0:1][fly.color],fly.x-halo/2,fly.y-halo/2,halo,halo);
      ctx.save();ctx.translate(fly.x,fly.y);ctx.rotate(fly.angle+Math.sin(wave)*.25);
      // Translucent wings flutter independently of the slowly drifting light.
      const wing=fly.size*(1.3+Math.abs(Math.sin(time*19+fly.phase))*1.7);
      ctx.globalAlpha=opacity*.3;ctx.fillStyle=night?'#fff3d1':'#c59b4c';
      ctx.beginPath();ctx.ellipse(-wing*.62,-1.2*fly.size,wing,.75*fly.size,-.55,0,Math.PI*2);
      ctx.ellipse(wing*.62,-1.2*fly.size,wing,.75*fly.size,.55,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=opacity*.9;ctx.fillStyle=night?(fly.color===1?'#efffde':'#fff5c7'):['#b47922','#43865f','#8d61b8'][fly.color];
      ctx.beginPath();ctx.ellipse(0,.6*fly.size,.85*fly.size,1.65*fly.size,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(right>0 && bottom>0 && left<width && top<height)dirtyRect={left:Math.max(0,Math.floor(left)),top:Math.max(0,Math.floor(top)),right:Math.min(width,Math.ceil(right)),bottom:Math.min(height,Math.ceil(bottom))};
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';count();
    if(particles.length || point){canvas.dataset.state='flying';schedule();}
    else{lastTime=0;previous=null;carry=0;canvas.dataset.state='idle';erase();}
  }
  document.addEventListener('pointermove',event=>{
    if(!enabled || event.pointerType==='touch')return;
    if(field(event.target)){point=null;previous=null;carry=0;return;}
    point={x:event.clientX,y:event.clientY};schedule();
  },{passive:true});
  root.addEventListener('pointerleave',()=>{point=null;previous=null;carry=0;});
  document.addEventListener('pointercancel',()=>{point=null;previous=null;carry=0;},{passive:true});
  addEventListener('resize',resize,{passive:true});
  addEventListener('blur',clear);
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('focusin',sync);
  document.addEventListener('focusout',()=>queueMicrotask(sync));
  reduced.addEventListener('change',sync);fine.addEventListener('change',sync);
  navigator.connection?.addEventListener('change',sync);
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-app','data-motion','data-theme']});
  new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  addEventListener('pagehide',()=>{closed=true;sync();});
  addEventListener('pageshow',()=>{closed=false;resize();sync();});
  resize();sync();
})();
