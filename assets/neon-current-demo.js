/* Browser sample of the active Main.tscn → iconic/main_learning_loop.gd,
 * Player.tscn → player_visual_clarity → meta_expansion → stabilized → magnet_fixed → player.
 * Native units, fixed 60Hz physics. Opening sections only, not a Godot web build. */
(() => {
  'use strict';
  const root=document.querySelector('.neon-lab');if(!root)return;
  const en=document.documentElement.lang==='en',t=(ru,enText)=>en?enText:ru;
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  const status=root.querySelector('[data-neon-status]'),score=root.querySelector('[data-neon-score]');
  const W=1080,H=1920,R=34,STEP=1/60,START_Y=1500;
  canvas.width=W;canvas.height=H;
  const textures={};
  for(const [key,file] of Object.entries({wall:'neon-wall-current.png',magenta:'neon-wall-magenta.png',charged:'neon-wall-charged.png',spike:'neon-wall-spike.png',stand:'neon-boy-stand.png',flight:'neon-boy-flight.png',climb:'neon-boy-wall.png',trail:'neon-trail-classic.png',background:'neon-world-01.webp',coin:'neon-coin.png'})){
    const image=new Image();image.src='/assets/demo/'+file;image.onload=()=>draw();textures[key]=image;
  }
  const spread=x=>540+(x-540)*1.2;
  // Authored geometry: Pattern_Start, Pattern_OutskirtsSteps, Pattern_FirstSignalArc.
  const startWalls=[[240,-317,96,1000],[840,-253,96,1000],[540,-280,540,60]];
  const steps=[[840,-170,96,430],[240,-710,96,480,'magenta'],[840,-1230,96,500],[240,-1600,96,420,'magenta'],[600,-720,96,360,'spike']];
  const arc=[[250,-190,96,620,'magenta'],[830,-590,96,640,'charged'],[250,-1010,96,660,'magenta'],[830,-1430,96,660],[250,-1740,96,340,'magenta']];
  const walls=[];let coins=[];
  function section(data,origin){data.forEach(([x,y,w,h,kind='wall'])=>walls.push({x:spread(x),y:y+origin,w,h,kind}));}
  section(startWalls,1500);section(steps,900);
  // Native minimum separation: content_top + 140 = 1950 for OutskirtsSteps.
  section(arc,-1050);
  const coinPositions=[[650,575],[420,110],[650,-420],[540,-1440],[540,-1860],[540,-2280],[670,-1860],[550,-1940],[430,-2000],[330,-2015]];
  let x,y,vx,vy,side,launchSide,attached,contactWall,holding,thrust,boost,boostUsed,contactTime,redirects,coyote,buffer,ignoreWall,ignoreTime;
  let camera,height,started,dead,complete,last=0,accumulator=0,frame=0,visible=true,trail=[],trailFade=0,trailCount=0,phase=0,flash=0,charge=0,impact=0,hitstop=0,combo=0,coinCount=0;
  const moveToward=(a,b,n)=>a<b?Math.min(a+n,b):Math.max(a-n,b);
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function line(x1,y1,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function reset(){cancelAnimationFrame(frame);x=900-48-R+2.5;y=1220-30-R-6;vx=vy=0;side=launchSide=1;attached='wall';contactWall=walls[1];holding=false;thrust=boost=boostUsed=contactTime=redirects=coyote=buffer=ignoreTime=0;ignoreWall=null;camera=y-H*.17;height=0;started=dead=complete=false;trail=[];trailFade=trailCount=phase=flash=charge=impact=hitstop=combo=coinCount=0;coins=coinPositions.map(([cx,cy])=>({x:spread(cx),y:cy,taken:false}));score.textContent='0 m';status.textContent=t('Тап — прыжок · удержание — ускорение · второй тап — разворот','Tap to jump · hold to boost · tap again to redirect');updateState();draw();}
  function updateState(){root.dataset.gameState=dead?'dead':complete?'complete':attached||'flight';root.dataset.height=String(height);root.dataset.pose=attached==='wall'?'wall':attached==='platform'?'stand':'flight';root.dataset.coins=String(coinCount);root.dataset.combo=String(combo);}
  function finish(fell){dead=fell;complete=!fell;holding=false;status.textContent=fell?t('Падение. ↺ — попробовать ещё раз.','You fell. ↺ — try again.'):t('Первый участок пройден! Продолжение — в игре. ↺ — ещё раз.','Opening section cleared! Continue in the game. ↺ — try again.');updateState();}
  function launch(){
    if(attached){const perfect=contactTime<=.145,charged=contactWall?.kind==='charged';launchSide=side;
      vx=-side*900*(charged?1.36:1);vy=-930*(charged?1.28:1);
      if(perfect){vx*=1.06;vy*=1.035;status.textContent='PERFECT KICK';}else status.textContent=t('Удерживайте для ускорения','Hold to boost');
      ignoreWall=contactWall;ignoreTime=.14;x+=Math.sign(vx)*16;if(attached==='platform')y-=6;
      attached=null;contactWall=null;redirects=1;thrust=0;boost=.30;boostUsed=0;contactTime=0;coyote=0;charge=charged?.42:0;impact=6.5;
    }else if(coyote>0){vx=-side*900;vy=-930;coyote=0;redirects=1;thrust=0;}
    else if(redirects>0){vx=launchSide*900;vy=-930;redirects=0;flash=1;impact=3;status.textContent=t('Разворот в воздухе','Air redirect');}
    else buffer=.17;
  }
  function press(){if(dead||complete)return;holding=true;if(!started){started=true;last=performance.now();}launch();updateState();resume(false);}
  function release(){holding=false;boost=0;}
  function land(w,kind,newSide,incoming){
    attached=kind;contactWall=w;side=launchSide=newSide;vx=0;vy=kind==='wall'?Math.max(-180,Math.min(120,incoming*.45)):0;
    if(kind==='wall')x=w.x-newSide*(w.w/2+R-3);else y=w.y-w.h/2-R+1.5;
    thrust=boost=boostUsed=contactTime=redirects=0;ignoreWall=null;combo++;hitstop=.036;impact=5;trailFade=.52;trailCount=trail.length;
    status.textContent=t('Стена поймана. Тап — следующий прыжок.','Wall caught. Tap for the next jump.');
    if(buffer>0){buffer=0;launch();}
  }
  function physics(){
    phase+=STEP;flash=Math.max(0,flash-STEP*4.5);charge=Math.max(0,charge-STEP);impact=moveToward(impact,0,STEP*24);
    coyote=Math.max(0,coyote-STEP);buffer=Math.max(0,buffer-STEP);ignoreTime=Math.max(0,ignoreTime-STEP);
    if(hitstop>0){hitstop-=STEP;return;}
    if(attached){contactTime+=STEP;vx=0;if(attached==='wall'){vy=moveToward(vy,120,2400*STEP);y+=vy*STEP;if(y>contactWall.y+contactWall.h/2+5||y<contactWall.y-contactWall.h/2-24){attached=null;contactWall=null;coyote=.17;}}
      if(trailFade>0){trailFade=Math.max(0,trailFade-STEP);const f=trailFade/.52;trail.length=Math.min(trail.length,Math.ceil(trailCount*f*f*(3-2*f)));}
    }else{
      // player_stabilized applies its short X/Y hold boost before parent gravity/thrust.
      if(holding&&boost>0){const used=Math.min(STEP,boost);boost-=used;boostUsed+=used;vx+=Math.sign(vx||-launchSide)*1050*used;vy-=920*used;}
      vy+=2100*STEP;if(holding&&thrust<1){vy-=1400*STEP;thrust+=STEP;}
      const oldX=x,oldY=y;x+=vx*STEP;y+=vy*STEP;
      for(const w of walls){if(w===ignoreWall&&ignoreTime>0)continue;
        const left=w.x-w.w/2,right=w.x+w.w/2,top=w.y-w.h/2,bottom=w.y+w.h/2;
        if(x+R<left||x-R>right||y+R<top||y-R>bottom)continue;
        const topHit=vy>=0&&oldY+R<=top+6;
        if(w.kind==='spike'&&!topHit){finish(true);break;}
        if(topHit){land(w,'platform',w.x>=x?-1:1,vy);break;}
        if(vx>0&&oldX+R<=left+8&&y>=top&&y<=bottom){land(w,'wall',1,vy);break;}
        if(vx<0&&oldX-R>=right-8&&y>=top&&y<=bottom){land(w,'wall',-1,vy);break;}
        if(vy<0&&oldY-R>=bottom-6){y=bottom+R;vy=0;}
      }
      if(!attached){trail.unshift({x,y});trail=trail.slice(0,36);}
    }
    for(const coin of coins)if(!coin.taken&&Math.hypot(x-coin.x,y-coin.y)<R+39){coin.taken=true;coinCount++;}
    height=Math.max(height,Math.round((START_Y-y)/100));score.textContent=height+' m';
    const target=y-400;if(target<camera)camera+=(target-camera)*.08;
    if(y>camera+H*.55)finish(true);else if(y<-3000)finish(false);updateState();
  }
  // CurvedSpriteTrail: screen-up normal, source U head=1, taper .38→1, length≤640.
  function drawTrail(){if(trail.length<2||!textures.trail.naturalWidth||dead)return;
    const direction=Math.sign(vx||-launchSide),points=[{x:x-direction*26,y:y+8},...trail.slice(1)],lengths=[0];let length=0;
    for(let i=1;i<points.length;i++){length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);lengths.push(length);}
    length=Math.min(640,length);if(length<3)return;
    for(let i=0;i<points.length-1&&lengths[i]<length;i++){
      const a=points[i],b=points[i+1],head=1-lengths[i]/length,tail=Math.max(0,1-lengths[i+1]/length),u=(head+tail)/2;
      const half=30*(.38+.62*u);ctx.save();ctx.globalAlpha=.90*(.22+.78*u);
      const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)<.01){ctx.restore();continue;}
      ctx.transform(-dx,-dy,0,half*2,b.x,b.y-camera+H/2-half);
      const img=textures.trail,sourceX=tail*img.naturalWidth,sourceW=Math.max(1,(head-tail)*img.naturalWidth);
      ctx.drawImage(img,sourceX,0,sourceW,img.naturalHeight,0,0,1,1);ctx.restore();
      if(charge>0)line(a.x,a.y-camera+H/2,b.x,b.y-camera+H/2,`rgba(255,194,46,${head*charge/.42*.58})`,1.5+head*2.2);
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#040a19';ctx.fillRect(0,0,W,H);
    const bg=textures.background;if(bg?.naturalWidth){const cover=Math.max(W/bg.naturalWidth,H/bg.naturalHeight);ctx.drawImage(bg,(W-bg.naturalWidth*cover)/2,(H-bg.naturalHeight*cover)/2,bg.naturalWidth*cover,bg.naturalHeight*cover);ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgb(204,214,245)';ctx.fillRect(0,0,W,H);ctx.restore();ctx.fillStyle='rgba(0,2,6,.27)';ctx.fillRect(0,0,W,H);}
    // CyberBackdropClarity's quiet edge ribbons and phase gates, not foreground obstacles.
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(const [side,offset,color] of [[-1,phase*.31,'25,239,255'],[1,phase*.27+2.4,'255,50,210'],[-1,phase*.19+4.7,'25,239,255']]){
        const breathe=.62+.38*Math.sin(offset*.72);for(const [width,alpha] of [[13,.018],[4,.052],[1,.085]]){ctx.strokeStyle=`rgba(${color},${alpha*breathe})`;ctx.lineWidth=width;ctx.beginPath();for(let i=0;i<18;i++){const p=i/17,wave=Math.sin(p*Math.PI*2*1.35+offset)*W*.030+Math.sin(p*Math.PI*2*3.1-offset*.62)*W*.012,px=W*(side<0?.055:.945)+side*wave;i?ctx.lineTo(px,p*H):ctx.moveTo(px,p*H);}ctx.stroke();}
      }
      const scroll=((phase*24+camera*.085)%(H+420)+(H+420))%(H+420)-210;
      for(let i=0;i<3;i++){const cy=((scroll+i*(H+420)/3)%(H+420)+(H+420))%(H+420)-210,radius=W*(.29+i*.055),pulse=.5+.5*Math.sin(phase*(.32+i*.06)+i*2.1),rotation=phase*(.055+i*.014)*(i%2?-1:1);ctx.strokeStyle=`rgba(${i===2?'255,50,210':'25,239,255'},${(.018+pulse*.025)*(.55+i*.18)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,cy,radius,rotation,rotation+Math.PI*.70);ctx.stroke();}
    }
    ctx.save();const shake=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:impact;ctx.translate(Math.sin(phase*93)*shake,Math.cos(phase*79)*shake*.6);
    for(const w of walls){const sy=w.y-camera+H/2;if(sy+w.h/2<0||sy-w.h/2>H)continue;const img=textures[w.kind];if(img?.naturalWidth)ctx.drawImage(img,w.x-w.w/2,sy-w.h/2,w.w,w.h);}
    for(const coin of coins){if(coin.taken)continue;const sy=coin.y-camera+H/2;if(sy<-64||sy>H+64)continue;const pulse=.5+.5*Math.sin(phase*5);circle(coin.x,sy,58+pulse*4,'#ff9e0a12');ctx.save();ctx.translate(coin.x,sy);ctx.rotate(phase*2.5);const img=textures.coin;if(img.naturalWidth)ctx.drawImage(img,-40,-40,80,80);ctx.restore();}
    drawTrail();
    if(!dead){const sy=y-camera+H/2,pose=attached==='wall'?'climb':attached==='platform'?'stand':'flight',img=textures[pose];
      if(img?.naturalWidth){const target=(pose==='climb'?112*1.014:pose==='flight'?116*.826:118)*4/3,s=target/img.naturalHeight;
        const flip=pose==='climb'?side<0:pose==='flight'?Math.sign(vx||-launchSide)<0:false;
        ctx.save();ctx.translate(x+(pose==='climb'?side*10:0),sy+(pose==='stand'?7:0));ctx.scale(flip?-1:1,1);ctx.drawImage(img,-img.naturalWidth*s/2,-target/2,img.naturalWidth*s,target);ctx.restore();}
      if(attached==='wall'){line(x+side*R,sy-19,x+side*R,sy+19,'#19efffbd',4);line(x+side*R,sy,x+side*(R-14),sy,'#e6ffff9e',3);}
      if(holding&&!attached&&thrust<1)for(let i=0;i<3;i++){const d=-Math.sign(vx||-launchSide),off=i*7;line(x+d*(29+off),sy+14+off,x+d*(47+off*2),sy+38+off*1.6,'#19efff77',3.5-i*.65);}
      if(flash>0){ctx.strokeStyle=`rgba(191,255,255,${flash*.6})`;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<20;i++){const p=i/19,hx=x-Math.sign(vx)*(24+Math.sin(p*Math.PI)*52),hy=sy+22+p*66;i?ctx.lineTo(hx,hy):ctx.moveTo(hx,hy);}ctx.stroke();}
    }
    ctx.restore();ctx.fillStyle='#06efff';ctx.fillRect(300,100,480*Math.max(0,1-thrust),4);
    if(dead||complete){ctx.fillStyle='#04091ec9';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e6fbff';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText(dead?t('ЕЩЁ ОДИН ПРЫЖОК?','ONE MORE JUMP?'):t('УЧАСТОК ПРОЙДЕН','SECTION CLEARED'),540,900);ctx.font='28px sans-serif';ctx.fillText(t('↺ — начать заново','↺ — try again'),540,970);ctx.textAlign='start';}
  }
  function tick(now){accumulator+=Math.min(.1,(now-last)/1000);last=now;while(accumulator>=STEP&&!dead&&!complete){physics();accumulator-=STEP;}draw();if(visible&&!document.hidden&&started&&!dead&&!complete)frame=requestAnimationFrame(tick);}
  function resume(stopHold=true){cancelAnimationFrame(frame);if(stopHold)release();accumulator=0;last=performance.now();if(visible&&!document.hidden&&started&&!dead&&!complete)frame=requestAnimationFrame(tick);}
  for(const el of [canvas,root.querySelector('[data-neon-jump]')]){
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);press();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,release);
    el.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)&&!e.repeat){e.preventDefault();press();}});
    el.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))release();});el.addEventListener('blur',release);
  }
  root.querySelector('[data-neon-reset]').addEventListener('click',reset);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();}).observe(canvas);
  document.addEventListener('visibilitychange',()=>resume());window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);release();});reset();
})();
