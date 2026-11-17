import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildLogoVoxels,logoScrollAngle,rotationMatrix,createSceneLoop,createPointerMotion,advancePointer,satellitePose,projectScenePoint} from '../assets/studio-logo-model.mjs';
import {SATELLITE_ORDER,buildSatelliteModel} from '../assets/studio-satellite-models.mjs';

const near=(actual,expected,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} is not close to ${expected}`);

function pixels(){
  const rgba=new Uint8ClampedArray(8*8*4);
  const paint=(x,y,color)=>rgba.set(color,(y*8+x)*4);
  paint(1,1,[245,235,255,255]);
  paint(2,5,[95,58,182,255]);
  return {rgba,paint};
}

test('the logo creates finite, symmetric volume from opaque pixels and excludes transparent background',()=>{
  const {rgba}=pixels(),geometry=buildLogoVoxels(rgba,8,8);
  assert.ok(geometry instanceof Float32Array);
  assert.equal(geometry.length%8,0);
  assert.ok(geometry.length>0);
  assert.ok([...geometry].every(Number.isFinite));
  const voxels=Array.from({length:geometry.length/8},(_,i)=>Array.from(geometry.slice(i*8,i*8+8)));
  assert.equal(voxels.length,4,'two source pixels should produce two mirrored pairs, not a solid image rectangle');
  for(const voxel of voxels){
    assert.ok(voxel[3]>0,'every voxel must have actual depth');
    assert.ok(voxels.some(other=>Math.abs(other[0]+voxel[0])<1e-5&&other.slice(1).every((v,i)=>Math.abs(v-voxel[i+1])<1e-5)),
      'each voxel must have a matching counterpart across the logo center');
  }
  assert.equal(buildLogoVoxels(new Uint8ClampedArray(8*8*4),8,8).length,0);
});

test('right-edge source artifacts cannot introduce stray voxels into the symmetric logo',()=>{
  const {rgba,paint}=pixels(),clean=buildLogoVoxels(rgba,8,8);
  paint(7,3,[255,0,0,255]);
  assert.deepEqual(buildLogoVoxels(rgba,8,8),clean);
});

test('scroll rotation follows scene position, remains bounded, and has a static reduced-motion view',()=>{
  const values=[-200,0,224,300,500,1000,5000].map(y=>logoScrollAngle(y,800,300,800));
  near(values[0],-.25);
  for(let i=0;i<values.length;i++){
    assert.ok(Number.isFinite(values[i]));
    assert.ok(values[i]>=-.25001&&values[i]<=1.30001);
    if(i)assert.ok(values[i]>=values[i-1],'scrolling forward must not reverse the turn');
  }
  assert.ok(values.at(-1)>values[0]);
  assert.ok(logoScrollAngle(500,800,300,800)>logoScrollAngle(500,1400,300,800),
    'a scene below mobile hero copy must start turning later than one near the page top');
  for(const y of [0,500,5000])assert.equal(logoScrollAngle(y,800,300,800,true),0);
});

test('the column-major rotation preserves lengths without distorting the logo',()=>{
  for(const [yaw,pitch] of [[0,0],[-.25,.12],[1.3,-.35],[Math.PI/2,Math.PI/4]]){
    const matrix=rotationMatrix(yaw,pitch);
    assert.equal(matrix.length,9);
    assert.ok([...matrix].every(Number.isFinite));
    for(const vector of [[1,0,0],[0,1,0],[0,0,1],[.3,-.7,1.2]]){
      const out=[0,1,2].map(row=>matrix[row]*vector[0]+matrix[3+row]*vector[1]+matrix[6+row]*vector[2]);
      near(Math.hypot(...out),Math.hypot(...vector));
    }
  }
  const identity=rotationMatrix(0,0);
  for(let i=0;i<9;i++)near(identity[i],i%4===0?1:0);
});

function loopFixture(){
  const pending=new Map(),renders=[];
  let serial=0;
  const loop=createSceneLoop({requestFrame:fn=>{pending.set(++serial,fn);return serial;},cancelFrame:id=>pending.delete(id),render:time=>renders.push(time)});
  return {loop,pending,renders,step(time=100){
    const jobs=[...pending.values()];pending.clear();
    for(const fn of jobs)fn(time);
  }};
}

test('many scroll invalidations share one frame and one continuing animation loop',()=>{
  const f=loopFixture();
  for(let i=0;i<100;i++)f.loop.invalidate();
  assert.equal(f.pending.size,1);
  f.step(120);
  assert.deepEqual(f.renders,[120]);
  assert.equal(f.pending.size,1);
  for(let i=0;i<100;i++)f.loop.invalidate();
  assert.equal(f.pending.size,1);
  f.step(160);
  assert.deepEqual(f.renders,[120,160]);
  assert.equal(f.pending.size,1);
});

test('offscreen, hidden and unloaded scenes stop drawing and resume only when all blockers clear',()=>{
  const f=loopFixture();f.loop.invalidate();
  f.loop.setVisible(false);
  assert.equal(f.pending.size,0);
  f.loop.setHidden(true);f.loop.setClosed(true);
  f.loop.invalidate();f.step();
  assert.equal(f.renders.length,0);
  f.loop.setVisible(true);assert.equal(f.pending.size,0);
  f.loop.setHidden(false);assert.equal(f.pending.size,0);
  f.loop.setClosed(false);assert.equal(f.pending.size,1);
  f.loop.setVisible(true);f.loop.setHidden(false);f.loop.setClosed(false);
  assert.equal(f.pending.size,1,'repeated resume events must not duplicate the loop');
  f.step(240);assert.deepEqual(f.renders,[240]);
  for(const [pause,resume] of [['setHidden','setHidden'],['setClosed','setClosed']]){
    f.loop[pause](true);assert.equal(f.pending.size,0);
    f.loop.invalidate();assert.equal(f.pending.size,0);
    f.loop[resume](false);assert.equal(f.pending.size,1);
  }
});

test('reduced motion redraws a requested static frame without keeping an idle animation running',()=>{
  const f=loopFixture();f.loop.setReduced(true);
  // A preference change may request a replacement static frame immediately.
  f.step(10);f.renders.length=0;
  for(let i=0;i<20;i++)f.loop.invalidate();
  assert.equal(f.pending.size,1);
  f.step(320);
  assert.deepEqual(f.renders,[320]);
  assert.equal(f.pending.size,0);
  f.step(360);assert.deepEqual(f.renders,[320]);
  f.loop.setHidden(true);f.loop.invalidate();assert.equal(f.pending.size,0);
  f.loop.setHidden(false);assert.equal(f.pending.size,1);
  f.step(400);assert.deepEqual(f.renders,[320,400]);assert.equal(f.pending.size,0);
  f.loop.setReduced(false);assert.equal(f.pending.size,1);
  f.step(440);assert.equal(f.pending.size,1);
});

// Execute the actual renderer with browser/GPU boundaries replaced, rather than
// reimplementing its initialization or cleanup logic in the test.
const rendererSource=readFileSync(new URL('../assets/studio-logo-scene.mjs',import.meta.url),'utf8').replace(/^import[^;\n]*;\r?\n/gm,'');

function eventTarget(){
  const handlers=new Map();
  return {
    addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},
    removeEventListener(name,fn){handlers.get(name)?.delete(fn);},
    emit(name,event={}){for(const fn of [...(handlers.get(name)||[])])fn(event);},
    listenerCount(){return [...handlers.values()].reduce((sum,items)=>sum+items.size,0);}
  };
}

export async function rendererFixture({missingObserver,failShader=0,failLink=0,noWebGL=false,reducedMotion=false,withSatellites=false,sourceText=rendererSource}={}){
  const pending=new Map(),canvases=[],observers=[],meshFrames=[],uniforms=new Map(),styleWrites=[],uniformCalls=[],drawFrames=[];
  const programUniforms=new Map(),canvasBounds={left:68,top:128,width:464,height:464};let activeProgram=null;
  function recordUniform(location,value){
    uniforms.set(location.name,value);uniformCalls.push({program:location.program.order,name:location.name,value});
    if(!programUniforms.has(location.program))programUniforms.set(location.program,new Map());
    programUniforms.get(location.program).set(location.name,value);
  }
  function recordDraw(mode,count,instances){
    const state=programUniforms.get(activeProgram)||new Map();
    drawFrames.push({program:activeProgram.order,mode,count,instances,uniforms:Object.fromEntries([...state].sort(([a],[b])=>a<b?-1:a>b?1:0))});
  }
  const live={shaders:new Set(),programs:new Set(),buffers:new Set(),arrays:new Set()};
  let serial=0,shaderCount=0,programCount=0,draws=0;
  const allocate=(kind,extra={})=>{const resource={id:++serial,...extra};live[kind].add(resource);return resource;};
  const gl={
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,
    COLOR_BUFFER_BIT:8,DEPTH_BUFFER_BIT:16,DEPTH_TEST:17,BLEND:18,TRIANGLES:19,POINTS:20,SRC_ALPHA:21,ONE:22,NO_ERROR:0,ELEMENT_ARRAY_BUFFER:23,UNSIGNED_SHORT:24,CULL_FACE:25,
    createShader:type=>allocate('shaders',{type,order:++shaderCount}),deleteShader:s=>live.shaders.delete(s),
    getShaderParameter:s=>s.order!==failShader,
    createProgram:()=>allocate('programs',{order:++programCount}),deleteProgram:p=>live.programs.delete(p),
    getProgramParameter:p=>p.order!==failLink,
    createBuffer:()=>allocate('buffers'),deleteBuffer:b=>live.buffers.delete(b),
    createVertexArray:()=>allocate('arrays'),deleteVertexArray:a=>live.arrays.delete(a),
    getUniformLocation:(program,name)=>({program,name}),getError:()=>0,
    drawElementsInstanced(mode,count,type,offset,instances){assert.equal(mode,gl.TRIANGLES);assert.equal(count,36);assert.equal(type,gl.UNSIGNED_SHORT);assert.equal(offset,0);assert.ok(instances>0);draws++;meshFrames.push(new Map(uniforms));recordDraw(mode,count,instances);},drawArrays(mode,start,count){draws++;recordDraw(mode,count,1);}
  };
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','bufferData','bindVertexArray',
    'enableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','viewport','clearColor','clear','enable','depthMask',
    'disable','useProgram','uniform2f','uniform1f','uniform3f','uniform4f','blendFunc'])gl[name]=()=>{};
  gl.useProgram=program=>{activeProgram=program;};
  gl.uniformMatrix3fv=(location,transpose,value)=>recordUniform(location,Array.from(value));
  gl.uniform4f=(location,...values)=>recordUniform(location,values);
  gl.uniform3f=(location,...values)=>recordUniform(location,values);
  gl.uniform2f=(location,...values)=>recordUniform(location,values);
  gl.uniform1f=(location,value)=>recordUniform(location,value);
  const rgba=new Uint8ClampedArray(80*80*4);rgba.set([245,235,255,255],(10*80+10)*4);
  const image={complete:true,naturalWidth:80};
  const root={...eventTarget(),dataset:{siteWorld:'studio'}};
  const satellites=withSatellites?SATELLITE_ORDER.map(()=>{
    const properties=new Map(),link={closest:()=>link};
    return {properties,link,style:{setProperty:(key,value)=>{styleWrites.push([key,value]);properties.set(key,value);},getPropertyValue:key=>properties.get(key)||'',removeProperty:key=>properties.delete(key)},contains:node=>node===link};
  }):[];
  const visual={...eventTarget(),dataset:{},children:[],querySelector:selector=>selector==='.core-logo'?image:null,querySelectorAll:()=>satellites,closest:()=>null,
    getBoundingClientRect:()=>({top:160,left:100,width:400,height:400}),append(node){this.children.push(node);node.parent=this;}};
  const document={...eventTarget(),documentElement:root,hidden:false,readyState:'complete',activeElement:null,fonts:{ready:Promise.resolve()},
    querySelector:selector=>selector==='.visual'?visual:null,
    createElement(tag){
      assert.equal(tag,'canvas');
      const canvas={...eventTarget(),className:'',parent:null,setAttribute(){},getBoundingClientRect:()=>({...canvasBounds}),
        getContext(type){return type==='2d'?{drawImage(){},getImageData:()=>({data:rgba})}:noWebGL?null:gl;},
        remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}}};
      canvases.push(canvas);return canvas;
    }};
  const window={...eventTarget()};
  const media={...eventTarget(),matches:reducedMotion};
  function observerClass(){return class{
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
    observe(){}disconnect(){this.disconnected=true;}
  };}
  const context={document,window,matchMedia:()=>media,IntersectionObserver:observerClass(),ResizeObserver:observerClass(),MutationObserver:observerClass(),
    scrollY:0,innerWidth:1280,innerHeight:800,devicePixelRatio:1,
    requestAnimationFrame:fn=>{pending.set(++serial,fn);return serial;},cancelAnimationFrame:id=>pending.delete(id),
    buildLogoVoxels,logoScrollAngle,rotationMatrix,createSceneLoop,createPointerMotion,advancePointer,satellitePose,projectScenePoint,SATELLITE_ORDER,buildSatelliteModel};
  if(missingObserver)context[missingObserver]=undefined;
  vm.runInNewContext(sourceText.replace(/^import[^;\n]*;\r?\n/gm,''),context);
  // Let boot's rejection handler and the real fonts.ready continuation settle.
  await new Promise(resolve=>setImmediate(resolve));
  return {root,visual,image,window,document,media,canvases,observers,live,pending,meshFrames,uniforms,satellites,styleWrites,uniformCalls,drawFrames,context,draws:()=>draws,
    resizeCanvas(width,height,dpr=context.devicePixelRatio){canvasBounds.width=width;canvasBounds.height=height;context.devicePixelRatio=dpr;window.emit('resize');},
    step(time=100){const jobs=[...pending.values()];pending.clear();for(const fn of jobs)fn(time);}};
}

const assertNoGpuResources=f=>{for(const [kind,resources] of Object.entries(f.live))assert.equal(resources.size,0,`${kind} must be released`);};
const assertFallback=f=>{
  assert.equal(f.visual.dataset.logoScene,undefined,'the fallback must not be hidden');
  assert.equal(f.visual.querySelector('.core-logo'),f.image,'the original image remains available');
  assert.equal(f.visual.children.length,0,'no detached or failed scene is displayed');
  assert.equal(f.pending.size,0,'failure must not leave an animation frame queued');
};

test('unsupported observers exit before graphics initialization and leave the original logo available',async()=>{
  for(const missingObserver of ['IntersectionObserver','ResizeObserver','MutationObserver']){
    const f=await rendererFixture({missingObserver});
    assertFallback(f);assertNoGpuResources(f);
    assert.equal(f.canvases.length,0);
    assert.equal(f.observers.length,0);
    assert.equal(f.window.listenerCount(),0);
  }
});

test('an unavailable WebGL context keeps the image without starting background work',async()=>{
  const f=await rendererFixture({noWebGL:true});
  assertFallback(f);assertNoGpuResources(f);
  assert.equal(f.observers.length,0);
  assert.equal(f.window.listenerCount(),0);
  assert.equal(f.root.listenerCount(),0);
  assert.equal(f.root.listenerCount(),0);
});

test('shader and program-link failures release earlier GPU allocations without scheduling leaked frames',async()=>{
  // Fail while building the second program, after the first program exists.
  for(const failure of [{failShader:4},{failLink:2}]){
    const f=await rendererFixture(failure);
    assertFallback(f);assertNoGpuResources(f);
    assert.equal(f.observers.length,0);
    assert.equal(f.window.listenerCount(),0);
    assert.equal(f.draws(),0);
  }
});

test('context loss removes a successfully rendered scene, restores the image, and cancels future drawing',async()=>{
  const f=await rendererFixture();
  assert.equal(f.visual.children.length,1);
  f.step(120);
  assert.equal(f.visual.dataset.logoScene,'ready');
  assert.equal(f.draws(),2,'the successful frame draws the logo and its fireflies');
  assert.equal(f.pending.size,1);
  const canvas=f.visual.children[0];
  canvas.emit('webglcontextlost');
  assertFallback(f);assertNoGpuResources(f);
  assert.ok(f.observers.every(observer=>observer.disconnected));
  assert.equal(f.window.listenerCount(),0);
  assert.equal(f.root.listenerCount(),0);
  assert.equal(f.document.listenerCount(),0);
  assert.equal(f.media.listenerCount(),0);
  assert.equal(f.visual.listenerCount(),0);
  assert.equal(canvas.listenerCount(),0);
  f.window.emit('scroll');f.window.emit('resize');f.window.emit('pageshow');
  f.document.emit('visibilitychange');f.media.emit('change');
  f.step(240);
  assert.equal(f.draws(),2,'no detached renderer continues to draw after context loss');
  assert.equal(f.pending.size,0);
});

test('mouse movement changes the rendered gaze and head while touch input leaves the scene undisturbed',async()=>{
  const mouse=await rendererFixture(),touch=await rendererFixture(),control=await rendererFixture();
  for(const f of [mouse,touch,control])f.step(100);
  const event={clientX:440,clientY:250,target:mouse.visual,pointerType:'mouse',preventDefault(){assert.fail('pointer tracking must not cancel page input');}};
  mouse.window.emit('pointermove',event);
  touch.window.emit('pointermove',{...event,target:touch.visual,pointerType:'touch'});
  for(let time=140;time<=1100;time+=40)for(const f of [mouse,touch,control])f.step(time);
  const frame=f=>f.meshFrames.at(-1);
  const attention=frame(mouse).get('attention');
  assert.ok(attention[0]>.5&&attention[1]>.3&&attention[2]>.2,'the visible gaze must react to a mouse near the face');
  assert.notDeepEqual(frame(mouse).get('rotation'),frame(control).get('rotation'));
  assert.ok(mouse.uniforms.get('attractor')[3]>.2,'fireflies should receive the same active pointer attraction');
  assert.deepEqual(frame(touch).get('attention'),frame(control).get('attention'));
  assert.deepEqual(frame(touch).get('rotation'),frame(control).get('rotation'));
  mouse.root.emit('pointerleave');
  for(let time=1140;time<=4140;time+=40)mouse.step(time);
  assert.ok(frame(mouse).get('attention').slice(0,3).every(value=>Math.abs(value)<1e-6),'leaving the page must release the gaze and attraction');
});

test('the actual renderer ignores pointer movement in reduced motion and returns to one static frame after a preference change',async()=>{
  const f=await rendererFixture({reducedMotion:true});f.step(100);
  assert.equal(f.pending.size,0);
  const event={clientX:440,clientY:250,target:f.visual,pointerType:'mouse'};
  f.window.emit('pointermove',event);
  assert.equal(f.pending.size,0,'mouse tracking must not restart animation in reduced mode');
  assert.deepEqual(f.meshFrames.at(-1).get('attention'),[0,0,0,1]);
  f.media.matches=false;f.media.emit('change');f.step(140);f.window.emit('pointermove',event);
  for(let time=180;time<=580;time+=40)f.step(time);
  assert.ok(f.meshFrames.at(-1).get('attention')[0]>.3);
  f.media.matches=true;f.media.emit('change');f.step(620);
  assert.deepEqual(f.meshFrames.at(-1).get('attention'),[0,0,0,1]);
  assert.equal(f.pending.size,0);
  f.window.emit('pointermove',event);f.window.emit('scroll');
  assert.equal(f.pending.size,0);
});

test('all seven real miniatures share the scene and their link targets follow the same depth projection',async()=>{
  const f=await rendererFixture({withSatellites:true});f.step(100);f.step(140);
  assert.equal(f.visual.dataset.satelliteScene,'ready');
  assert.equal(f.visual.children.length,1,'miniatures must reuse the existing canvas');
  assert.equal(f.draws(),18,'each frame draws one head, seven miniature meshes, and fireflies');
  const frames=f.meshFrames.slice(-8);
  for(let i=0;i<7;i++){
    const frame=frames[i+1],[x,y,z]=frame.get('placement'),bob=frame.get('bob');
    const screen=projectScenePoint({x,y:y+bob,z},464);
    const transform=f.satellites[i].properties.get('transform').match(/^translate3d\(([-\d.]+)px,([-\d.]+)px,0\)$/);
    assert.ok(transform,'each visible mesh needs a matching composited link transform');
    near(Number(transform[1]),screen.x,.006);near(Number(transform[2]),screen.y,.006);
  }
  f.visual.children[0].emit('webglcontextlost');
  assert.equal(f.visual.dataset.satelliteScene,undefined,'failed graphics must restore the original linked icons too');
  assert.ok(f.satellites.every(el=>!el.properties.has('transform')),'fallback icon positions must be restored after context loss');
  assertFallback(f);assertNoGpuResources(f);
});

test('redrawing an unchanged static scene preserves link targets without redundant style mutation',async()=>{
  const f=await rendererFixture({withSatellites:true,reducedMotion:true});f.step(100);
  const writes=f.styleWrites.length;
  assert.equal(writes,7,'one non-inherited transform per linked miniature is sufficient');
  f.visual.emit('focusin',{target:f.satellites[1].link});f.step(140);
  assert.equal(f.styleWrites.length,writes,'static focus redraw must not invalidate link styles again');
});

test('hover and keyboard focus pause orbital travel so miniature links remain stable targets',async()=>{
  const f=await rendererFixture({withSatellites:true});f.step(100);f.step(140);
  const latestPose=index=>f.meshFrames.slice(-8)[index+1].get('placement');
  f.window.emit('pointermove',{clientX:300,clientY:360,target:f.satellites[2].link,pointerType:'mouse'});
  f.step(180);const hoveredPose=latestPose(2);f.step(220);
  assert.deepEqual(latestPose(2),hoveredPose);
  f.window.emit('scroll');f.step(260);
  assert.notDeepEqual(latestPose(2),hoveredPose,'scrolling must release stale hover when the icon moves away from a stationary pointer');
  f.visual.emit('focusin',{target:f.satellites[1].link});
  f.step(300);const focusedPose=latestPose(1);f.step(340);
  assert.deepEqual(latestPose(1),focusedPose);
  f.visual.emit('focusout',{relatedTarget:null});f.step(380);
  assert.notDeepEqual(latestPose(1),focusedPose,'orbits resume after the target is released');
});


test('projection and density uploads are reused until a measured viewport change',async()=>{
  const f=await rendererFixture({withSatellites:true});f.step(100);
  const constants=()=>f.uniformCalls.filter(call=>call.name==='scale'||call.name==='density');
  assert.equal(constants().length,3,'initial projection is sent once to each program, plus point density');
  const originalResources=Object.fromEntries(Object.entries(f.live).map(([kind,items])=>[kind,items.size]));
  for(let time=140;time<=540;time+=40)f.step(time);
  assert.equal(constants().length,3,'steady frames must not resend unchanged projection or density');
  assert.equal(f.draws(),12*9,'all head, seven miniature and firefly draws remain present');
  for(const frame of f.drawFrames){
    assert.deepEqual(frame.uniforms.scale,[.66,.66]);
    if(frame.program===2)assert.equal(frame.uniforms.density,1);
  }
  f.resizeCanvas(620,464);f.step(580);
  assert.equal(constants().length,5,'changing the aspect ratio refreshes both program projections');
  for(const frame of f.drawFrames.slice(-9))assert.deepEqual(frame.uniforms.scale,[.66*464/620,.66]);
  const count=constants().length;f.window.emit('resize');f.step(620);assert.equal(constants().length,count,'an unchanged resize must not upload constants');
  f.resizeCanvas(620,464,2);f.step(660);
  const expectedDensity=1.5*(720/930);
  assert.equal(constants().length,count+3,'a high-DPI resize refreshes projection and density after backing-store rounding');
  for(const frame of f.drawFrames.slice(-9)){
    assert.deepEqual(frame.uniforms.scale,[.66*539/720,.66]);
    if(frame.program===2)near(frame.uniforms.density,expectedDensity,1e-12);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(f.live).map(([kind,items])=>[kind,items.size])),originalResources,'resizing adds no GPU resources');
});
