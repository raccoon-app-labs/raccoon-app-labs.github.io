import {buildLogoVoxels,logoScrollAngle,rotationMatrix,createSceneLoop} from './studio-logo-model.mjs?v=9e0b0bfd442d';

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
    delete visual.dataset.logoScene;canvas.remove();
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
      out vec3 tint;out vec3 face;out float emission;
      void main(){
        vec3 p=rotation*(vec3(vertex.xy*cell,vertex.z*voxel.w)+voxel.xyz);
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
      uniform float time;uniform vec2 scale;uniform float density;uniform float pulse;
      out float sparkle;out float mint;
      void main(){
        float phase=seed.x*6.283185;float t=time*seed.w;
        vec3 p=vec3(cos(phase+t*.19)*(1.03+seed.y*.42),sin(phase*1.7+t*.23)*(.9+seed.z*.35),sin(phase+t*.15)*.85);
        p.y+=sin(t*.7+phase)*.065;
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
    const meshArray=gl.createVertexArray();gl.bindVertexArray(meshArray);resources.push(()=>gl.deleteVertexArray(meshArray));
    buffer(new Float32Array(vertices));
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    buffer(voxels);
    for(const [location,offset] of [[2,0],[3,16]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.FLOAT,false,32,offset);gl.vertexAttribDivisor(location,1);}
    const fireflyArray=gl.createVertexArray();gl.bindVertexArray(fireflyArray);resources.push(()=>gl.deleteVertexArray(fireflyArray));
    const seeds=new Float32Array(42*4);for(let i=0;i<42;i++)seeds.set([(i*.6180339)%1,(i*.371)%1,(i*.219)%1,.65+(i%7)*.09],i*4);
    buffer(seeds);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);
    const uniforms=(p,names)=>Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(p,name)]));
    const m=uniforms(mesh,['rotation','scale','bob','cell','pulse']),f=uniforms(flies,['time','scale','density','pulse']);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let width=1,height=1,density=1,sceneTop=0,sceneHeight=1,viewportHeight=1,last=0,time=0,lastPaint=-1000,pulse=0,ready=false;
    visual.append(canvas);
    function measure(){
      if(disposed)return;
      const bounds=visual.getBoundingClientRect();sceneTop=bounds.top+scrollY;sceneHeight=bounds.height;viewportHeight=innerHeight;
      const rect=canvas.getBoundingClientRect();density=Math.min(devicePixelRatio||1,1.5);
      width=Math.max(1,Math.round(rect.width*density));height=Math.max(1,Math.round(rect.height*density));
      // Bound the backing store on large monitors as well as high-DPI phones.
      const cap=Math.min(1,720/Math.max(width,height));width=Math.round(width*cap);height=Math.round(height*cap);density*=cap;
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      loop.invalidate();
    }
    function draw(now){
      if(disposed)return;
      if(!reduced.matches&&now-lastPaint<30)return;
      const dt=last?Math.min(.05,(now-last)/1000):0;last=now;lastPaint=now;
      time+=reduced.matches?0:dt;pulse=reduced.matches?0:pulse*Math.exp(-dt*3);
      const yaw=logoScrollAngle(scrollY,sceneTop,sceneHeight,viewportHeight,reduced.matches);
      gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
      gl.useProgram(mesh);gl.bindVertexArray(meshArray);
      gl.uniformMatrix3fv(m.rotation,false,rotationMatrix(yaw,-.1+(reduced.matches?0:Math.sin(time*.3)*.025)));
      gl.uniform2f(m.scale,.66*height/width,.66);gl.uniform1f(m.bob,reduced.matches?0:Math.sin(time*.7)*.024);
      gl.uniform1f(m.cell,2.4/79*.96);gl.uniform1f(m.pulse,pulse);
      gl.drawArraysInstanced(gl.TRIANGLES,0,36,voxels.length/8);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
      gl.useProgram(flies);gl.bindVertexArray(fireflyArray);gl.uniform1f(f.time,time);gl.uniform2f(f.scale,.79*height/width,.79);gl.uniform1f(f.density,density);gl.uniform1f(f.pulse,pulse);
      gl.drawArrays(gl.POINTS,0,reduced.matches?20:42);gl.depthMask(true);
      if(!ready){if(gl.getError()!==gl.NO_ERROR)throw new Error('Logo frame unavailable');ready=true;visual.dataset.logoScene='ready';}
    }
    const loop=createSceneLoop({requestFrame:requestAnimationFrame,cancelFrame:cancelAnimationFrame,render:now=>{try{draw(now);}catch{dispose();}}});
    resources.push(()=>loop.setClosed(true));
    const scroll=()=>{if(!reduced.matches)loop.invalidate();};
    const visibility=()=>{last=0;loop.setHidden(document.hidden);};
    const motion=()=>{last=0;lastPaint=-1000;loop.setReduced(reduced.matches);};
    const hide=()=>loop.setClosed(true),show=()=>{last=0;loop.setClosed(false);measure();};
    const burst=event=>{if(event.target.closest('.studio-orbit')&&!reduced.matches){pulse=1;loop.invalidate();}};
    const observer=new IntersectionObserver(entries=>{last=0;loop.setVisible(entries[0].isIntersecting);},{threshold:0});resources.push(()=>observer.disconnect());observer.observe(visual);
    const resize=new ResizeObserver(measure);resources.push(()=>resize.disconnect());resize.observe(visual);
    const language=new MutationObserver(measure);resources.push(()=>language.disconnect());language.observe(root,{attributes:true,attributeFilter:['lang']});
    const lost=()=>dispose();
    listen(canvas,'webglcontextlost',lost);
    listen(window,'scroll',scroll,{passive:true});listen(window,'resize',measure,{passive:true});
    listen(window,'pagehide',hide);listen(window,'pageshow',show);listen(document,'visibilitychange',visibility);listen(reduced,'change',motion);listen(visual,'click',burst);
    loop.setReduced(reduced.matches);loop.setHidden(document.hidden);measure();
    document.fonts?.ready.then(measure).catch(()=>{});
  }catch(error){dispose();throw error;}
}
