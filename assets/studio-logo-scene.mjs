import {buildLogoVoxels,logoScrollAngle,rotationMatrix,createSceneLoop,createPointerMotion,advancePointer,satellitePose,projectScenePoint} from './studio-logo-model.mjs?v=fb1074ae16d1';
import {SATELLITE_ORDER,buildSatelliteModel} from './studio-satellite-models.mjs?v=1da3c54d0e6a';

const root=document.documentElement;
const visual=root.dataset.siteWorld==='studio'?document.querySelector('.visual'):null;
const image=visual?.querySelector('.core-logo');
if(visual&&image)boot().catch(()=>{/* Keep the original mark if graphics are unavailable. */});

async function boot(){
  if(typeof IntersectionObserver!=='function'||typeof ResizeObserver!=='function'||typeof MutationObserver!=='function')return;
  if(!image.complete||!image.naturalWidth)await image.decode();
  const sample=document.createElement('canvas');sample.width=sample.height=80;
  const paint=sample.getContext('2d',{willReadFrequently:true});if(!paint)return;
  paint.drawImage(image,0,0,80,80);
  const voxels=buildLogoVoxels(paint.getImageData(0,0,80,80).data,80,80);
  if(!voxels.length)return;
  const canvas=document.createElement('canvas');canvas.className='studio-logo-scene';canvas.setAttribute('aria-hidden','true');
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl)return;
  const resources=[];let disposed=false;
  const dispose=()=>{
    if(disposed)return;disposed=true;
    resources.reverse().forEach(release=>{try{release();}catch{/* Context may already be lost. */}});
    delete visual.dataset.logoScene;delete visual.dataset.satelliteScene;canvas.remove();
  };
  const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);resources.push(()=>target.removeEventListener(type,handler,options));};
  try{
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Logo shader unavailable');}return s;}
    function program(vertex,fragment){
      let vs,fs;
      try{
        vs=shader(gl.VERTEX_SHADER,vertex);fs=shader(gl.FRAGMENT_SHADER,fragment);
        const p=gl.createProgram();resources.push(()=>gl.deleteProgram(p));
        gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Logo renderer unavailable');
        return p;
      }finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
    }
    const mesh=program(`#version 300 es
      precision highp float;
      layout(location=0) in vec3 vertex;layout(location=1) in vec3 normal;
      layout(location=2) in vec4 voxel;layout(location=3) in vec4 color;
      uniform mat3 rotation;uniform vec2 scale;uniform float bob;uniform float cell;
      uniform vec3 placement;uniform float modelSize;uniform float sceneTime;uniform vec4 attention;
      out vec3 tint;out vec3 face;out float emission;
      void main(){
        vec3 local=vec3(vertex.xy*cell,vertex.z*voxel.w)+voxel.xyz;
        if(color.a>.1)local.xy+=attention.xy*vec2(.05,.035)*attention.w;
        float ripple=sin(length(voxel.xy-attention.xy*.7)*11.-sceneTime*3.5)*.014;
        local.z+=ripple*attention.z*attention.w;
        vec3 p=rotation*local*modelSize+placement;
        p.y+=bob;float perspective=4.8/(4.8-p.z);
        gl_Position=vec4(p.xy*scale*perspective,-p.z*.14,1.);
        tint=color.rgb;face=rotation*normal;emission=color.a;
      }`, `#version 300 es
      precision mediump float;in vec3 tint;in vec3 face;in float emission;out vec4 pixel;
      uniform float pulse;
      void main(){
        float light=max(0.,dot(normalize(face),normalize(vec3(-.5,.8,1.))));
        light=floor(light*5.)/5.;vec3 rim=vec3(.15,.08,.28)*pow(1.-abs(face.z),2.);
        pixel=vec4(tint*(.48+light*.58)+rim+vec3(.26,.1,.5)*emission*(1.+pulse),1.);
      }`);
    const flies=program(`#version 300 es
      precision highp float;layout(location=0) in vec4 seed;
      uniform float time;uniform vec2 scale;uniform float density;uniform float pulse;uniform vec4 attractor;
      out float sparkle;out float mint;
      void main(){
        float phase=seed.x*6.283185;float t=time*seed.w;
        vec3 p=vec3(cos(phase+t*.19)*(1.03+seed.y*.42),sin(phase*1.7+t*.23)*(.9+seed.z*.35),sin(phase+t*.15)*.85);
        p.y+=sin(t*.7+phase)*.065;
        vec3 swarm=vec3(attractor.xy,attractor.z)+vec3(cos(phase+t*.7),sin(phase*1.3+t*.6),sin(phase+t*.4))*.36;
        p=mix(p,swarm,attractor.w*.72);
        gl_Position=vec4(p.xy*scale*(4.8/(4.8-p.z)),-p.z*.14,1.);
        sparkle=.35+.65*pow(.5+.5*sin(time*1.3+phase),3.);
        gl_PointSize=(10.+sparkle*9.+pulse*6.)*density;mint=step(.72,seed.y);
      }`, `#version 300 es
      precision mediump float;in float sparkle;in float mint;out vec4 pixel;
      void main(){
        float r=length(gl_PointCoord-.5);if(r>.5)discard;
        float halo=exp(-r*r*24.)*.35;float core=1.-smoothstep(.035,.13,r);
        vec3 color=mix(vec3(1.,.78,.32),vec3(.52,1.,.81),mint);
        pixel=vec4(color,(halo+core*.9)*sparkle);
      }`);
    function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);resources.push(()=>gl.deleteBuffer(b));return b;}
    const vertices=[];
    for(const [n,u,v] of [ [[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[0,1,0],[1,0,0]] ]){
      for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])vertices.push(...n.map((c,i)=>(c+u[i]*a+v[i]*b)*.5),...n);
    }
    const cubeBuffer=buffer(new Float32Array(vertices));
    function model(data,cell){
      const array=gl.createVertexArray();gl.bindVertexArray(array);resources.push(()=>gl.deleteVertexArray(array));
      gl.bindBuffer(gl.ARRAY_BUFFER,cubeBuffer);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
      buffer(data);
      for(const [location,offset] of [[2,0],[3,16]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.FLOAT,false,32,offset);gl.vertexAttribDivisor(location,1);}
      return {array,cell,count:data.length/8};
    }
    const head=model(voxels,2.4/79*.96);
    const satellites=[...(visual.querySelectorAll?.('.studio-satellite')??[])];
    const miniatures=satellites.length===SATELLITE_ORDER.length?SATELLITE_ORDER.map(name=>{const shape=buildSatelliteModel(name);return model(shape.voxels,shape.cell);}):[];
    const fireflyArray=gl.createVertexArray();gl.bindVertexArray(fireflyArray);resources.push(()=>gl.deleteVertexArray(fireflyArray));
    const seeds=new Float32Array(42*4);for(let i=0;i<42;i++)seeds.set([(i*.6180339)%1,(i*.371)%1,(i*.219)%1,.65+(i%7)*.09],i*4);
    buffer(seeds);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);
    const uniforms=(p,names)=>Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(p,name)]));
    const m=uniforms(mesh,['rotation','scale','bob','cell','pulse','placement','modelSize','sceneTime','attention']),f=uniforms(flies,['time','scale','density','pulse','attractor']);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let width=1,height=1,density=1,sceneTop=0,sceneLeft=0,sceneWidth=1,sceneHeight=1,canvasHeight=1,viewportHeight=1,last=0,time=0,orbitTime=0,lastPaint=-1000,pulse=0,ready=false,hovered=-1,focused=-1,lastPointer=null;
    const pointer=createPointerMotion(),target={x:0,y:0,strength:0};
    visual.append(canvas);
    function measure(){
      if(disposed)return;
      hovered=-1;
      const bounds=visual.getBoundingClientRect();sceneTop=bounds.top+scrollY;sceneLeft=bounds.left;sceneWidth=bounds.width;sceneHeight=bounds.height;viewportHeight=innerHeight;
      const rect=canvas.getBoundingClientRect();density=Math.min(devicePixelRatio||1,1.5);
      canvasHeight=rect.height;
      width=Math.max(1,Math.round(rect.width*density));height=Math.max(1,Math.round(rect.height*density));
      // Bound the backing store on large monitors as well as high-DPI phones.
      const cap=Math.min(1,720/Math.max(width,height));width=Math.round(width*cap);height=Math.round(height*cap);density*=cap;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      updatePointer();loop.invalidate();
    }
    function drawModel(shape,{x=0,y=0,z=0,size=1,yaw=0,pitch=0,roll=0,bob=0,alive=false,glow=0}={}){
      gl.bindVertexArray(shape.array);gl.uniformMatrix3fv(m.rotation,false,rotationMatrix(yaw,pitch,roll));
      gl.uniform3f(m.placement,x,y,z);gl.uniform1f(m.modelSize,size);gl.uniform1f(m.bob,bob);gl.uniform1f(m.cell,shape.cell);
      gl.uniform4f(m.attention,pointer.x,pointer.y,pointer.strength,alive?1:0);gl.uniform1f(m.pulse,glow);
      gl.drawArraysInstanced(gl.TRIANGLES,0,36,shape.count);
    }
    function draw(now){
      if(disposed)return;
      if(!reduced.matches&&now-lastPaint<30)return;
      const dt=last?Math.min(.05,(now-last)/1000):0;last=now;lastPaint=now;
      time+=reduced.matches?0:dt;pulse=reduced.matches?0:pulse*Math.exp(-dt*3);
      advancePointer(pointer,target,dt,reduced.matches);
      if(!reduced.matches&&hovered<0&&focused<0)orbitTime+=dt;
      const yaw=logoScrollAngle(scrollY,sceneTop,sceneHeight,viewportHeight,reduced.matches)+pointer.x*.23;
      gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
      gl.useProgram(mesh);gl.uniform2f(m.scale,.66*height/width,.66);gl.uniform1f(m.sceneTime,time);
      drawModel(head,{x:pointer.x*.025,y:pointer.y*.018,yaw,pitch:-.1-pointer.y*.17+(reduced.matches?0:Math.sin(time*.3)*.025),roll:-pointer.x*.045,bob:reduced.matches?0:Math.sin(time*.7)*.024,alive:true,glow:pulse+pointer.strength*.6});
      miniatures.forEach((shape,index)=>{
        const pose=satellitePose(index,orbitTime),over=!reduced.matches&&(index===hovered||index===focused);
        drawModel(shape,{...pose,size:pose.scale*(over?1.16:1),yaw:pose.yaw+(over?.9:0),bob:reduced.matches?0:Math.sin(time*.9+index)*.018,glow:over?.35:0});
        const screen=projectScenePoint({...pose,y:pose.y+(reduced.matches?0:Math.sin(time*.9+index)*.018)},canvasHeight);
        satellites[index].style.setProperty('--satellite-x',screen.x.toFixed(2)+'px');satellites[index].style.setProperty('--satellite-y',screen.y.toFixed(2)+'px');
      });
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
      gl.useProgram(flies);gl.bindVertexArray(fireflyArray);gl.uniform1f(f.time,time);gl.uniform2f(f.scale,.66*height/width,.66);gl.uniform1f(f.density,density);gl.uniform1f(f.pulse,pulse);
      gl.uniform4f(f.attractor,pointer.x*1.15,pointer.y*1.15,1.1,pointer.strength);
      gl.drawArrays(gl.POINTS,0,reduced.matches?20:42);gl.depthMask(true);
      if(!ready){if(gl.getError()!==gl.NO_ERROR)throw new Error('Logo frame unavailable');ready=true;visual.dataset.logoScene='ready';if(miniatures.length)visual.dataset.satelliteScene='ready';}
    }
    const loop=createSceneLoop({requestFrame:requestAnimationFrame,cancelFrame:cancelAnimationFrame,render:now=>{try{draw(now);}catch{dispose();}}});
    resources.push(()=>loop.setClosed(true));
    function updatePointer(){
      if(!lastPointer||reduced.matches)return;
      const x=(lastPointer.x-sceneLeft-sceneWidth*.5)/(sceneWidth*.5),y=(sceneTop-scrollY+sceneHeight*.5-lastPointer.y)/(sceneHeight*.5);
      target.x=Math.max(-1,Math.min(1,x));target.y=Math.max(-1,Math.min(1,y));target.strength=Math.max(0,1-Math.hypot(x,y)/1.55);
    }
    const satelliteIndex=node=>{const link=node?.closest?.('.studio-satellite a');return link?satellites.findIndex(el=>el.contains(link)):-1;};
    const move=event=>{if(event.pointerType==='touch')return;lastPointer={x:event.clientX,y:event.clientY};hovered=satelliteIndex(event.target);updatePointer();if(!reduced.matches)loop.invalidate();};
    const leave=()=>{lastPointer=null;hovered=-1;Object.assign(target,{x:0,y:0,strength:0});if(!reduced.matches)loop.invalidate();};
    const focus=event=>{focused=satelliteIndex(event.target);loop.invalidate();};
    const blur=event=>{focused=satelliteIndex(event.relatedTarget);loop.invalidate();};
    const scroll=()=>{hovered=-1;if(!reduced.matches){updatePointer();loop.invalidate();}};
    const visibility=()=>{last=0;loop.setHidden(document.hidden);};
    const motion=()=>{last=0;lastPaint=-1000;if(reduced.matches)leave();loop.setReduced(reduced.matches);};
    const hide=()=>loop.setClosed(true),show=()=>{last=0;loop.setClosed(false);measure();};
    const burst=event=>{if(event.target.closest('.studio-orbit')&&!reduced.matches){pulse=1;loop.invalidate();}};
    const observer=new IntersectionObserver(entries=>{last=0;loop.setVisible(entries[0].isIntersecting);},{threshold:0});resources.push(()=>observer.disconnect());observer.observe(visual);
    const resize=new ResizeObserver(measure);resources.push(()=>resize.disconnect());resize.observe(visual);
    const language=new MutationObserver(measure);resources.push(()=>language.disconnect());language.observe(root,{attributes:true,attributeFilter:['lang']});
    const lost=()=>dispose();
    listen(canvas,'webglcontextlost',lost);
    listen(window,'scroll',scroll,{passive:true});listen(window,'resize',measure,{passive:true});
    listen(window,'pointermove',move,{passive:true});listen(window,'blur',leave);listen(root,'pointerleave',leave);listen(visual,'focusin',focus);listen(visual,'focusout',blur);
    listen(window,'pagehide',hide);listen(window,'pageshow',show);listen(document,'visibilitychange',visibility);listen(reduced,'change',motion);listen(visual,'click',burst);
    loop.setReduced(reduced.matches);loop.setHidden(document.hidden);measure();
    document.fonts?.ready.then(measure).catch(()=>{});
  }catch(error){dispose();throw error;}
}
