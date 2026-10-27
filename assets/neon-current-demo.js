/* Browser sample of the active Main.tscn → iconic/main_learning_loop.gd,
 * Player.tscn → player_visual_clarity → meta_expansion → stabilized → magnet_fixed → player.
 * Native units, fixed 60Hz physics. Opening sections only, not a Godot web build. */
(() => {
  'use strict';
  const root=document.querySelector('.neon-lab');if(!root)return;
  const en=document.documentElement.lang==='en',t=(ru,enText)=>en?enText:ru;
  const canvasText=(ru,english)=>document.documentElement.lang==='ru'?ru:(window.HanziLocale?.t(english) ?? english);
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  const status=root.querySelector('[data-neon-status]'),score=root.querySelector('[data-neon-score]');
  const coinLabel=root.querySelector('[data-neon-coins]'),pauseButton=root.querySelector('[data-neon-pause]'),jumpButton=root.querySelector('[data-neon-jump]');
  const W=1080,H=1920,R=34,STEP=1/60,START_Y=1500;
  canvas.width=W;canvas.height=H;
  let art=window.NeonDemoArt || {};
  const textures={},previews={};
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const bitmap=key=>textures[key]?.naturalWidth?textures[key]:previews[key];
  let fullArtRequested=false;
  function loadPreviews(){
    for(const [key,spec] of Object.entries(art)){
      const image=new Image();previews[key]=image;
      image.onload=()=>{root.dataset.artState='preview';draw();};image.src=spec.preview;
    }
  }
  async function sharpenArt(){
    if(fullArtRequested)return;fullArtRequested=true;
    // One optional transfer at a time. A slow/failing asset never blocks play
    // or competes with the page's visible screenshots.
    for(const key of ['climb','flight','stand','part_body','part_arm_back','part_arm_front','part_leg_back','part_leg_front','part_star','hazard','coin','trail','far','mid','near']){
      if(!visible){fullArtRequested=false;return;}
      if(!art[key]||textures[key]?.naturalWidth)continue;
      await new Promise(resolve=>{
        const image=new Image();image.decoding='async';image.fetchPriority='low';
        image.onload=()=>{textures[key]=image;draw();resolve();};
        image.onerror=()=>{root.dataset.artFallback='true';resolve();};image.src=art[key].src;
      });
    }
    root.dataset.artState='ready';
  }
  window.addEventListener('neon:artready',()=>{art=window.NeonDemoArt || {};fullArtRequested=false;loadPreviews();if(visible)sharpenArt();});
  const spread=x=>540+(x-540)*1.2;
  // Authored geometry: Pattern_Start, Pattern_OutskirtsSteps, Pattern_FirstSignalArc.
  const startWalls=[[240,-317,96,1000],[840,-253,96,1000],[540,-250,780,60]];
  const steps=[[840,-170,96,430],[240,-710,96,480,'magenta'],[840,-1230,96,500],[240,-1600,96,420,'magenta'],[600,-720,96,360,'spike']];
  const arc=[[250,-190,96,620,'magenta'],[830,-590,96,640,'charged'],[250,-1010,96,660,'magenta'],[830,-1430,96,660],[250,-1740,96,340,'magenta']];
  const walls=[];let coins=[];
  function section(data,origin){data.forEach(([x,y,w,h,kind='wall'])=>walls.push({x:spread(x),y:y+origin,w,h,kind}));}
  section(startWalls,1500);section(steps,900);
  // Native minimum separation: content_top + 140 = 1950 for OutskirtsSteps.
  section(arc,-1050);
  const coinPositions=[[650,575],[420,110],[650,-420],[540,-1440],[540,-1860],[540,-2280],[670,-1860],[550,-1940],[430,-2000],[330,-2015]];
  const hazards=[[765,1340],[323.33334,1330],[440,1340],[640,1340]].map(([cx,cy])=>({x:spread(cx),y:cy,r:60}));
  let paused=false,pauseStatus='',launchAge=100,landingAge=100,landingStrength=0,puppetFlight=false,lastDraw=0,effects=[];
  let x,y,vx,vy,side,launchSide,attached,contactWall,holding,thrust,boost,boostUsed,contactTime,redirects,coyote,buffer,ignoreWall,ignoreTime;
  let camera,height,started,dead,complete,last=0,accumulator=0,frame=0,visible=false,trail=[],trailFade=0,trailCount=0,phase=0,flash=0,charge=0,impact=0,hitstop=0,combo=0,coinCount=0;
  const moveToward=(a,b,n)=>a<b?Math.min(a+n,b):Math.max(a-n,b);
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function line(x1,y1,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function reset(){cancelAnimationFrame(frame);paused=false;pauseStatus='';launchAge=landingAge=100;landingStrength=0;puppetFlight=false;effects=[];lastDraw=0;x=900-48-R+2.5;y=1220-30-R-6;vx=vy=0;side=launchSide=1;attached='wall';contactWall=walls[1];holding=false;thrust=boost=boostUsed=contactTime=redirects=coyote=buffer=ignoreTime=0;ignoreWall=null;camera=y-H*.17;height=0;started=dead=complete=false;trail=[];trailFade=trailCount=phase=flash=charge=impact=hitstop=combo=coinCount=0;coins=coinPositions.map(([cx,cy])=>({x:spread(cx),y:cy,taken:false}));score.textContent='0 m';status.textContent=t('Тап — прыжок · удержание — ускорение · второй тап — разворот','Tap to jump · hold to boost · tap again to redirect');updateState();draw();resume(false);}
  function updateState(){
    const state={gameState:paused?'paused':dead?'dead':complete?'complete':attached||'flight',paused,height,
      pose:attached==='wall'?'wall':attached==='platform'?'stand':'flight',coins:coinCount,combo,
      renderer:puppetFlight&&!attached?'articulated':'pose'};
    for(const [key,value] of Object.entries(state))if(root.dataset[key]!==String(value))root.dataset[key]=String(value);
    if(coinLabel&&coinLabel.textContent!==String(coinCount))coinLabel.textContent=String(coinCount);
    if(pauseButton){
      const label=canvasText(paused?'Продолжить':'Пауза',paused?'Resume':'Pause'),icon=paused?'▶':'Ⅱ';
      if(pauseButton.textContent!==icon)pauseButton.textContent=icon;
      if(pauseButton.getAttribute('aria-pressed')!==String(paused))pauseButton.setAttribute('aria-pressed',String(paused));
      if(pauseButton.getAttribute('aria-label')!==label)pauseButton.setAttribute('aria-label',label);
      pauseButton.disabled=dead||complete;
    }
    jumpButton.disabled=paused;
  }
  function finish(fell){dead=fell;complete=!fell;holding=false;status.textContent=fell?t('Падение. ↺ — попробовать ещё раз.','You fell. ↺ — try again.'):t('Первый участок пройден! Продолжение — в игре. ↺ — ещё раз.','Opening section cleared! Continue in the game. ↺ — try again.');updateState();}
  function launch(){
    if(attached){const perfect=contactTime<=.145,charged=contactWall?.kind==='charged';launchSide=side;
      vx=-side*900*(charged?1.36:1);vy=-930*(charged?1.28:1);
      if(perfect){vx*=1.06;vy*=1.035;status.textContent='PERFECT KICK';}else status.textContent=t('Удерживайте для ускорения','Hold to boost');
      launchAge=0;landingAge=100;puppetFlight=partsReady()&&!reduced.matches;burst('kick',x+side*R,y,side);
      ignoreWall=contactWall;ignoreTime=.14;x+=Math.sign(vx)*16;if(attached==='platform')y-=6;
      attached=null;contactWall=null;redirects=1;thrust=0;boost=.30;boostUsed=0;contactTime=0;coyote=0;charge=charged?.42:0;impact=6.5;
    }else if(coyote>0){vx=-side*900;vy=-930;coyote=0;redirects=1;thrust=0;}
    else if(redirects>0){vx=launchSide*900;vy=-930;redirects=0;flash=1;impact=3;launchAge=0;burst('redirect',x,y,launchSide);status.textContent=t('Разворот в воздухе','Air redirect');}
    else buffer=.17;
  }
  function press(){if(paused||dead||complete)return;holding=true;if(!started){started=true;last=performance.now();}launch();updateState();resume(false);}
  function release(){holding=false;boost=0;}
  function land(w,kind,newSide,incoming){
    landingStrength=Math.min(1,Math.max(.25,Math.hypot(vx,incoming)/1100));landingAge=0;launchAge=100;burst('land',kind==='wall'?w.x-newSide*w.w/2:x,kind==='wall'?y:w.y-w.h/2,newSide);
    attached=kind;contactWall=w;side=launchSide=newSide;vx=0;vy=kind==='wall'?Math.max(-180,Math.min(120,incoming*.45)):0;
    if(kind==='wall')x=w.x-newSide*(w.w/2+R-3);else y=w.y-w.h/2-R+1.5;
    thrust=boost=boostUsed=contactTime=redirects=0;ignoreWall=null;combo++;hitstop=.036;impact=5;trailFade=.52;trailCount=trail.length;
    status.textContent=t('Стена поймана. Тап — следующий прыжок.','Wall caught. Tap for the next jump.');
    if(buffer>0){buffer=0;launch();}
  }
  function physics(){
    if(paused)return;
    phase+=STEP;launchAge+=STEP;landingAge+=STEP;effects=effects.filter(fx=>(fx.age+=STEP)<.55);flash=Math.max(0,flash-STEP*4.5);charge=Math.max(0,charge-STEP);impact=moveToward(impact,0,STEP*24);
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
    for(const coin of coins)if(!coin.taken&&Math.hypot(x-coin.x,y-coin.y)<R+39){coin.taken=true;coinCount++;burst('coin',coin.x,coin.y,0);}
    for(const hazard of hazards)if(Math.hypot(x-hazard.x,y-hazard.y)<R+hazard.r){finish(true);break;}
    height=Math.max(height,Math.round((START_Y-y)/100));if(score.textContent!==height+' m')score.textContent=height+' m';
    const target=y-400;if(target<camera)camera+=(target-camera)*.08;
    if(y>camera+H*.55)finish(true);else if(y<-3000)finish(false);updateState();
  }
  // CurvedSpriteTrail: screen-up normal, source U head=1, taper .38→1, length≤640.
  function drawTrail(){if(trail.length<2||!bitmap('trail')?.naturalWidth||dead)return;
    const direction=Math.sign(vx||-launchSide),points=[{x:x-direction*26,y:y+8},...trail.slice(1)],lengths=[0];let length=0;
    for(let i=1;i<points.length;i++){length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);lengths.push(length);}
    length=Math.min(640,length);if(length<3)return;
    for(let i=0;i<points.length-1&&lengths[i]<length;i++){
      const a=points[i],b=points[i+1],head=1-lengths[i]/length,tail=Math.max(0,1-lengths[i+1]/length),u=(head+tail)/2;
      const half=30*(.38+.62*u);ctx.save();ctx.globalAlpha=.90*(.22+.78*u);
      const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)<.01){ctx.restore();continue;}
      ctx.transform(-dx,-dy,0,half*2,b.x,b.y-camera+H/2-half);
      const img=bitmap('trail'),sourceX=tail*img.naturalWidth,sourceW=Math.max(1,(head-tail)*img.naturalWidth);
      ctx.drawImage(img,sourceX,0,sourceW,img.naturalHeight,0,0,1,1);ctx.restore();
      if(charge>0)line(a.x,a.y-camera+H/2,b.x,b.y-camera+H/2,`rgba(255,194,46,${head*charge/.42*.58})`,1.5+head*2.2);
    }
  }
  const PARTS=['body','arm_back','arm_front','leg_back','leg_front','star'];
  const partsReady=()=>PARTS.every(id=>bitmap('part_'+id)?.naturalWidth>0);
  const smooth=(a,b,value)=>{const u=Math.min(1,Math.max(0,(value-a)/(b-a)));return u*u*(3-2*u);};
  const impulse=(age,duration)=>{const u=Math.min(1,Math.max(0,age/duration));return Math.sin(u*Math.PI)*(1-u*.35);};
  function burst(kind,px,py,face){if(!reduced.matches)effects.push({kind,x:px,y:py,side:face,age:0});}
  function drawEffects(){
    for(const fx of effects){
      const u=fx.age/.55;ctx.save();ctx.globalAlpha=(1-u)*(1-u);ctx.translate(fx.x,fx.y-camera+H/2);
      const count=fx.kind==='coin'?7:5;
      for(let i=0;i<count;i++){
        const a=i*Math.PI*2/count+(fx.side<0?Math.PI:0),d=12+u*(fx.kind==='redirect'?95:70);
        const px=Math.cos(a)*d,py=Math.sin(a)*d+u*u*25,r=(1-u)*(i%2?6:9);
        polygon([[px,py-r],[px+r*.55,py],[px,py+r],[px-r*.55,py]],i%2?'#fff1ba':fx.kind==='coin'?'#ffdf68':'#ff735c',true);
      }
      ctx.restore();
    }
  }
  function drawHazards(){
    const img=bitmap('hazard'),spec=art.hazard;
    for(let i=0;i<hazards.length;i++){
      const hazard=hazards[i],sy=hazard.y-camera+H/2;if(sy<-90||sy>H+90)continue;
      ctx.save();ctx.translate(hazard.x,sy);ctx.rotate(reduced.matches?0:phase*2.2+i*1.7);
      if(img?.naturalWidth){const extent=Math.max(spec.bounds[2]-spec.bounds[0],spec.bounds[3]-spec.bounds[1]);const w=spec.size[0]*120/extent,h=spec.size[1]*120/extent;ctx.drawImage(img,-w/2,-h/2,w,h);}
      else for(let blade=0;blade<5;blade++){ctx.rotate(Math.PI*2/5);polygon([[0,-15],[8,-60],[49,-44],[24,-31],[25,-3]],'#ff735c',true);}
      ctx.restore();
    }
  }
  function drawPuppet(sy){
    // Same anchors and rigid painted parts as gameplay_comet_puppet.gd.
    const rise=smooth(120,1050,-vy),fall=smooth(100,850,vy),apex=1-smooth(90,380,Math.abs(vy)),beat=impulse(launchAge,.30);
    const joints={arm_back:.25-.75*rise+apex*.88-beat*.12,arm_front:-.30-1.35*rise-apex*.82+fall*.34,leg_back:-.12-.90*rise+apex*.24,leg_front:.12+.78*rise-apex*.16+fall*.10};
    const facing=Math.sign(vx||-launchSide),fit=135/350;
    const angle=facing*(-.10+.23*smooth(-850,850,vy)) -facing*.07*beat;
    ctx.save();ctx.translate(x,sy-2.5*beat);ctx.rotate(angle);ctx.scale(facing<0?-fit:fit,fit);ctx.translate(-256,-208);
    function part(id,px,py,pivotX,pivotY,scale,turn){
      const img=bitmap('part_'+id),spec=art['part_'+id];ctx.save();ctx.translate(px,py);ctx.rotate(turn);ctx.scale(scale,scale);
      ctx.drawImage(img,-pivotX,-pivotY,spec.size[0],spec.size[1]);ctx.restore();
    }
    part('arm_back',227,232,186,117,.30,joints.arm_back);
    part('leg_back',247,272,201,91,.30,joints.leg_back);
    part('leg_front',278,274,117,91,.30,joints.leg_front);
    part('body',95,10,16,16,.52,0);
    part('arm_front',291,231,171,117,.30,joints.arm_front);
    const a=joints.arm_front,wx=291+(-Math.cos(a)-220*Math.sin(a))*.30,wy=231+(-Math.sin(a)+220*Math.cos(a))*.30;
    part('star',wx+7,wy-4,151,155,.12,-a*.35);ctx.restore();
  }
  function drawHero(sy){
    if(!attached&&puppetFlight){drawPuppet(sy);return;}
    const pose=attached==='wall'?'climb':attached==='platform'?'stand':'flight',img=bitmap(pose);
    if(img?.naturalWidth){
      const spec=art[pose],bounds=spec.bounds,target=135*spec.size[1]/Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
      const scale=target/img.naturalHeight,flip=pose==='climb'?side>0:pose==='flight'?Math.sign(vx||-launchSide)<0:false;
      const reach=(spec.size[0]/2-bounds[0])*target/spec.size[1],ox=pose==='climb'?side*(R-reach):0;
      const oy=pose==='stand'?R-(bounds[3]-spec.size[1]/2)*target/spec.size[1]:0;
      const supportX=pose==='climb'?side*R:0,supportY=pose==='stand'?R:0;
      const settle=reduced.matches?1:1-.026*landingStrength*impulse(landingAge,.32);
      ctx.save();ctx.translate(x+supportX,sy+supportY);ctx.scale(settle,settle);ctx.translate(ox-supportX,oy-supportY);
      if(pose==='flight'&&!reduced.matches)ctx.rotate(Math.sign(vx)*(-.08+Math.max(0,Math.min(1,(vy+850)/1700))*.18));
      ctx.scale(flip?-1:1,1);ctx.drawImage(img,-img.naturalWidth*scale/2,-target/2,img.naturalWidth*scale,target);ctx.restore();
    }else{
      ctx.save();ctx.translate(x,sy);polygon([[-38,-45],[-65,-82],[-8,-65],[12,-84],[49,-43],[40,18],[7,36],[-34,13]],'#fff1ba');
      circle(-9,-12,7,'#102139');circle(20,-16,7,'#102139');line(0,24,-24,58,'#fff1ba',12);line(0,24,23,57,'#fff1ba',12);ctx.restore();
    }
  }
  function polygon(points,color,outline=false){
    ctx.fillStyle=color;ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();
    if(outline){ctx.strokeStyle='#0b1830';ctx.lineWidth=3.5;ctx.stroke();}
  }
  function drawWall(w,sy){
    // Port of comic_wall_art.gd: broad beveled planes, exact contact envelope.
    const horizontal=w.w>w.h,width=Math.min(w.w,w.h),length=Math.max(w.w,w.h),a=width/2,b=length/2;
    const c=Math.min(width*.42,length*.12),recess=Math.max(.78,1-8/a);
    const normal=[[-.26,-1],[.54,-.97],[1,-.81],[.94,-.52],[recess,-.22],[1,0],[.94,.40],[1,.81],[.22,1],[-.62,.96],[-1,.81],[-.94,.40],[-1,0],[-recess,-.22],[-.94,-.52],[-1,-.81]];
    const shape=normal.map(([px,py])=>[px*a,Math.abs(py)>.7?Math.sign(py)*(b-(1-Math.abs(py))*c/.2):py*b]);
    const charged=w.kind==='charged',danger=w.kind==='spike',base=charged?'#f7d16e':danger?'#6d6ba5':'#8297ca';
    ctx.save();ctx.translate(w.x,sy);if(horizontal)ctx.rotate(Math.PI/2);
    polygon(shape,base);ctx.save();ctx.clip();
    polygon([[a*.38,-b],[a,-b],[a,b],[a*.10,b],[a*.45,b*.25],[a*.13,-b*.24]],charged?'#b99d52':'#627198');
    polygon([[-a,-b],[-a*.66,-b],[-a*.74,b*.65],[-a,b]],charged?'#fff1cd':'#d0cfcf');ctx.restore();
    ctx.beginPath();shape.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.strokeStyle='#0b1830';ctx.lineWidth=3.5;ctx.stroke();
    if(charged)polygon([[a*.14,-b*.73],[-a*.36,b*.04],[a*.14,-b*.04],[-a*.12,b*.73],[a*.44,-b*.16],[-a*.05,-b*.05]],'#fff1cd',true);
    else{line(-a*.35,-b+12,a*.32,-b+15,'#d0cfcf',3);line(-a*.26,b*.12,a*.12,b*.17,'#3a4769',3);}
    if(danger){
      for(const edge of [-1,1])for(let i=0,n=Math.max(2,Math.floor(length/65));i<n;i++){
        const cy=-b+(i+.5)*length/n;
        polygon([[edge*a,cy-20],[edge*a,cy+20],[edge*(a+16),cy]],'#f0d6a4',true);
      }
      line(-a+8,b-4,a-8,b-4,'#b4ddc9',4);
    }
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#040a19';ctx.fillRect(0,0,W,H);
    // The current game's Solar world: independent depths tied to camera travel.
    for(const [key,depth] of [['far',.012],['mid',.07],['near',.22]]){
      const img=bitmap(key);if(!img?.naturalWidth)continue;
      const scale=Math.max(W/img.naturalWidth,H/img.naturalHeight);
      const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
      const shift=reduced.matches?0:((1500-camera)*depth)%ih;
      ctx.save();ctx.globalAlpha=.82;
      for(const tile of [-1,0,1])ctx.drawImage(img,(W-iw)/2,(H-ih)/2+shift+tile*ih,iw,ih);
      ctx.restore();
    }
    ctx.save();const shake=reduced.matches?0:impact;ctx.translate(Math.sin(phase*93)*shake,Math.cos(phase*79)*shake*.6);
    for(const w of walls){const sy=w.y-camera+H/2;if(sy+w.h/2<0||sy-w.h/2>H)continue;drawWall(w,sy);}
    for(const coin of coins){if(coin.taken)continue;const sy=coin.y-camera+H/2;if(sy<-64||sy>H+64)continue;const pulse=.5+.5*Math.sin(phase*5);circle(coin.x,sy,58+pulse*4,'#ff9e0a12');ctx.save();ctx.translate(coin.x,sy);ctx.rotate(phase*2.5);const img=bitmap('coin');if(img?.naturalWidth)ctx.drawImage(img,-40,-40,80,80);ctx.restore();}
    drawHazards();drawTrail();drawEffects();
    if(!dead){const sy=y-camera+H/2;drawHero(sy);
      if(holding&&!attached&&thrust<1)for(let i=0;i<3;i++){const d=-Math.sign(vx||-launchSide),off=i*7;line(x+d*(29+off),sy+14+off,x+d*(47+off*2),sy+38+off*1.6,'#19efff77',3.5-i*.65);}
      if(flash>0){ctx.strokeStyle=`rgba(191,255,255,${flash*.6})`;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<20;i++){const p=i/19,hx=x-Math.sign(vx)*(24+Math.sin(p*Math.PI)*52),hy=sy+22+p*66;i?ctx.lineTo(hx,hy):ctx.moveTo(hx,hy);}ctx.stroke();}
    }
    ctx.restore();
    if(paused){ctx.fillStyle='#071427ba';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff1ba';ctx.font='italic bold 64px sans-serif';ctx.textAlign='center';ctx.fillText(canvasText('ПАУЗА','PAUSED'),540,900);ctx.font='28px sans-serif';ctx.fillText(canvasText('▶ — продолжить забег','▶ — resume the run'),540,970);ctx.textAlign='start';}
    if(dead||complete){ctx.fillStyle='#04091ec9';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e6fbff';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText(dead?canvasText('ЕЩЁ ОДИН ПРЫЖОК?','ONE MORE JUMP?'):canvasText('УЧАСТОК ПРОЙДЕН','SECTION CLEARED'),540,900);ctx.font='28px sans-serif';ctx.fillText(canvasText('↺ — начать заново','↺ — try again'),540,970);ctx.textAlign='start';}
  }
  function tick(now){if(paused)return;const dt=Math.min(.1,(now-last)/1000);last=now;if(started)accumulator+=dt;else phase+=dt;while(started&&accumulator>=STEP&&!dead&&!complete){physics();accumulator-=STEP;}if(started||now-lastDraw>=1000/30){draw();lastDraw=now;}if(visible&&!paused&&!document.hidden&&(started||!reduced.matches)&&!dead&&!complete)frame=requestAnimationFrame(tick);}
  function resume(stopHold=true){cancelAnimationFrame(frame);if(stopHold)release();accumulator=0;last=performance.now();if(visible&&!paused&&!document.hidden&&(started||!reduced.matches)&&!dead&&!complete)frame=requestAnimationFrame(tick);}
  for(const el of [canvas,root.querySelector('[data-neon-jump]')]){
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);press();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,release);
    el.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)&&!e.repeat){e.preventDefault();press();}});
    el.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))release();});el.addEventListener('blur',release);
  }
  function togglePause(){if(dead||complete)return;paused=!paused;release();cancelAnimationFrame(frame);if(paused){pauseStatus=status.textContent;status.textContent=canvasText('Пауза. Нажмите ▶, чтобы продолжить.','Paused. Press ▶ to resume.');}else{status.textContent=pauseStatus;resume(false);}updateState();draw();}
  pauseButton?.addEventListener('click',togglePause);
  root.querySelector('[data-neon-reset]').addEventListener('click',reset);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)sharpenArt();resume();}).observe(canvas);
  window.addEventListener('hanzi:languagechange',()=>draw());
  document.addEventListener('visibilitychange',()=>resume());window.addEventListener('pageshow',()=>resume());window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);release();});reset();loadPreviews();
})();
