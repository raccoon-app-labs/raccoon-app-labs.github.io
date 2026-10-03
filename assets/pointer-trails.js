(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(any-pointer: fine)');
  const theme = document.body.dataset.product;
  const palettes = {stories: ['#ffd97a','#c9ffaf'], muropolis: ['#ad7857','#bd8b69'], keys: ['#c8523e','#e8ad53'], bloom: ['#dc8e9c','#65aa82'], neon: ['#46edff','#cf7dff'], food: ['#81af74','#e49f65'], dokupit: ['#65a891','#df9c78']};
  if (!palettes[theme] || reduced.matches || !fine.matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'pointer-trail'; canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style, {position:'fixed', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'50'});
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {canvas.remove();return;}
  let particles = [], frame = 0, previous, step = 0, lastSpawn = 0;
  const resize = () => {const dpr = Math.min(devicePixelRatio || 1, 2);canvas.width = Math.round(innerWidth*dpr);canvas.height = Math.round(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
  resize(); window.addEventListener('resize',resize,{passive:true});
  const clear = () => {cancelAnimationFrame(frame);frame=0;particles=[];previous=null;ctx.clearRect(0,0,innerWidth,innerHeight);};
  const ellipse = (x,y,rx,ry) => {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  const draw = now => {
    frame = 0;ctx.clearRect(0,0,innerWidth,innerHeight);
    particles = particles.filter(p=>now-p.born<p.life);
    for (const p of particles) {
      const age=(now-p.born)/p.life, fade=Math.pow(1-age,1.6);
      ctx.save();ctx.translate(p.x+(theme==='muropolis'?0:Math.sin(age*5+p.seed)*age*13),p.y+(theme==='muropolis'?0:-age*23));
      ctx.rotate(p.angle+(theme==='muropolis'?0:age*p.spin));ctx.scale(p.size,p.size);ctx.fillStyle=p.color;ctx.strokeStyle=p.color;ctx.globalAlpha=fade*(theme==='muropolis'?.35:.65);ctx.lineWidth=1.7;
      if (theme==='stories') {
        ctx.globalAlpha=fade*.12;ellipse(0,0,13,13);ctx.globalAlpha=fade*.72;
        ctx.shadowColor=p.color;ctx.shadowBlur=12;ellipse(0,0,2.3,3.2);ctx.shadowBlur=0;
        ctx.globalAlpha=fade*.38;ctx.fillStyle='#fff8d8';ellipse(-3,-2,3,1.6);ellipse(3,-2,3,1.6);
      } else if (theme==='muropolis') {
        ellipse(0,2.5,4.7,3.7);ellipse(-5,-2,1.8,2.4);ellipse(-2,-5,1.8,2.4);ellipse(2,-5,1.8,2.4);ellipse(5,-2,1.8,2.4);
      } else if (theme==='keys') {
        ctx.beginPath();ctx.arc(-3,0,3.7,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(.8,0);ctx.lineTo(9,0);ctx.lineTo(9,3);ctx.moveTo(5,0);ctx.lineTo(5,2.5);ctx.stroke();
      } else if (theme==='bloom') {
        for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);ellipse(0,-4,2.5,4);ctx.restore();}
        ctx.fillStyle='#ffd77b';ellipse(0,0,2);
      } else if (theme==='neon') {
        ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(5,0);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.stroke();
      } else if (theme==='food') {
        ctx.beginPath();ctx.moveTo(-6,5);ctx.bezierCurveTo(-8,-8,6,-9,7,-6);ctx.bezierCurveTo(10,4,0,9,-6,5);ctx.fill();ctx.strokeStyle='#fff9ed';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-5,5);ctx.lineTo(5,-5);ctx.stroke();
      } else {
        ctx.beginPath();ctx.roundRect(-6,-6,12,12,3);ctx.stroke();ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(-.5,2.5);ctx.lineTo(4,-3);ctx.stroke();
      }
      ctx.restore();
    }
    if (particles.length) frame=requestAnimationFrame(draw);
  };
  document.addEventListener('pointermove', e => {
    if(e.pointerType==='touch'||document.hidden||reduced.matches||!fine.matches)return;
    const now=performance.now(), point={x:e.clientX,y:e.clientY};
    if(!previous){previous=point;return;}
    const dx=point.x-previous.x,dy=point.y-previous.y,distance=Math.hypot(dx,dy);
    const spacing=theme==='muropolis'?25:theme==='neon'?14:22;
    if(distance<spacing||now-lastSpawn<22)return;
    // Place impressions along the actual pointer path, alternating left and right paws.
    const angle=Math.atan2(dy,dx), count=Math.min(5,Math.floor(distance/spacing));
    for(let i=1;i<=count;i++){
      const fraction=i/count,side=theme==='muropolis'?(step++%2?5:-5):0;
      particles.push({x:previous.x+dx*fraction-Math.sin(angle)*side,y:previous.y+dy*fraction+Math.cos(angle)*side,born:now,life:theme==='stories'?1600:theme==='neon'?650:1200,angle:theme==='muropolis'?angle+Math.PI/2:angle,size:theme==='muropolis'?1.15:.8+Math.random()*.35,spin:(Math.random()-.5)*2,seed:Math.random()*6,color:palettes[theme][Math.floor(Math.random()*2)]});
    }
    particles=particles.slice(-64);previous=point;lastSpawn=now;
    if(!frame)frame=requestAnimationFrame(draw);
  },{passive:true});
  document.addEventListener('pointerout',e=>{if(!e.relatedTarget)previous=null;},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('scroll',()=>{previous=null;},{passive:true});
  window.addEventListener('pagehide',clear);
  reduced.addEventListener('change',clear);fine.addEventListener('change',clear);
})();
