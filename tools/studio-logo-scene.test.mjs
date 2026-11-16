import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildLogoVoxels,logoScrollAngle,rotationMatrix,createSceneLoop} from '../assets/studio-logo-model.mjs';

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
const rendererSource=readFileSync(new URL('../assets/studio-logo-scene.mjs',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'');

function eventTarget(){
  const handlers=new Map();
  return {
    addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},
    removeEventListener(name,fn){handlers.get(name)?.delete(fn);},
    emit(name,event={}){for(const fn of [...(handlers.get(name)||[])])fn(event);},
    listenerCount(){return [...handlers.values()].reduce((sum,items)=>sum+items.size,0);}
  };
}

async function rendererFixture({missingObserver,failShader=0,failLink=0,noWebGL=false}={}){
  const pending=new Map(),canvases=[],observers=[];
  const live={shaders:new Set(),programs:new Set(),buffers:new Set(),arrays:new Set()};
  let serial=0,shaderCount=0,programCount=0,draws=0;
  const allocate=(kind,extra={})=>{const resource={id:++serial,...extra};live[kind].add(resource);return resource;};
  const gl={
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,
    COLOR_BUFFER_BIT:8,DEPTH_BUFFER_BIT:16,DEPTH_TEST:17,BLEND:18,TRIANGLES:19,POINTS:20,SRC_ALPHA:21,ONE:22,NO_ERROR:0,
    createShader:type=>allocate('shaders',{type,order:++shaderCount}),deleteShader:s=>live.shaders.delete(s),
    getShaderParameter:s=>s.order!==failShader,
    createProgram:()=>allocate('programs',{order:++programCount}),deleteProgram:p=>live.programs.delete(p),
    getProgramParameter:p=>p.order!==failLink,
    createBuffer:()=>allocate('buffers'),deleteBuffer:b=>live.buffers.delete(b),
    createVertexArray:()=>allocate('arrays'),deleteVertexArray:a=>live.arrays.delete(a),
    getUniformLocation:(program,name)=>({program,name}),getError:()=>0,
    drawArraysInstanced(){draws++;},drawArrays(){draws++;}
  };
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindBuffer','bufferData','bindVertexArray',
    'enableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','viewport','clearColor','clear','enable','depthMask',
    'disable','useProgram','uniformMatrix3fv','uniform2f','uniform1f','blendFunc'])gl[name]=()=>{};
  const rgba=new Uint8ClampedArray(80*80*4);rgba.set([245,235,255,255],(10*80+10)*4);
  const image={complete:true,naturalWidth:80};
  const root={dataset:{siteWorld:'studio'}};
  const visual={...eventTarget(),dataset:{},children:[],querySelector:selector=>selector==='.core-logo'?image:null,
    getBoundingClientRect:()=>({top:160,height:400}),append(node){this.children.push(node);node.parent=this;}};
  const document={...eventTarget(),documentElement:root,hidden:false,fonts:{ready:Promise.resolve()},
    querySelector:selector=>selector==='.visual'?visual:null,
    createElement(tag){
      assert.equal(tag,'canvas');
      const canvas={...eventTarget(),className:'',parent:null,setAttribute(){},getBoundingClientRect:()=>({width:464,height:464}),
        getContext(type){return type==='2d'?{drawImage(){},getImageData:()=>({data:rgba})}:noWebGL?null:gl;},
        remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}}};
      canvases.push(canvas);return canvas;
    }};
  const window={...eventTarget()};
  const media={...eventTarget(),matches:false};
  function observerClass(){return class{
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
    observe(){}disconnect(){this.disconnected=true;}
  };}
  const context={document,window,matchMedia:()=>media,IntersectionObserver:observerClass(),ResizeObserver:observerClass(),MutationObserver:observerClass(),
    scrollY:0,innerHeight:800,devicePixelRatio:1,
    requestAnimationFrame:fn=>{pending.set(++serial,fn);return serial;},cancelAnimationFrame:id=>pending.delete(id),
    buildLogoVoxels,logoScrollAngle,rotationMatrix,createSceneLoop};
  if(missingObserver)context[missingObserver]=undefined;
  vm.runInNewContext(rendererSource,context);
  // Let boot's rejection handler and the real fonts.ready continuation settle.
  await new Promise(resolve=>setImmediate(resolve));
  return {visual,image,window,document,media,canvases,observers,live,pending,draws:()=>draws,
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
