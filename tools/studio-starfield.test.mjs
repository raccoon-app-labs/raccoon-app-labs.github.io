import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/studio-space-flight.js',import.meta.url),'utf8');

function fixture({width=1280,height=844,dpr=2,reduced=false,fine=true,theme='dark',motion}={}){
  const frames=new Map(),observers=[],canvases=[],commands=[],listeners=[];let serial=0,gradientCount=0;
  function events(target={}){
    const handlers=new Map();
    return Object.assign(target,{
      addEventListener(name,fn,options){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);listeners.push({name,options});},
      emit(name,data={}){const event={preventDefault(){assert.fail('decorative input must not cancel native interaction');},...data};for(const fn of handlers.get(name)||[])fn(event);}
    });
  }
  function canvas(){
    const node={width:0,height:0,id:canvases.length},ctx={};canvases.push(node);
    for(const name of ['setTransform','clearRect','fillRect','beginPath','arc','ellipse','fill','moveTo','lineTo','stroke'])ctx[name]=(...args)=>commands.push({canvas:node.id,name,args});
    ctx.drawImage=(image,...args)=>commands.push({canvas:node.id,name:'drawImage',args,sprite:image.id});
    ctx.createRadialGradient=()=>{gradientCount++;return {addColorStop(){}};};
    for(const name of ['fillStyle','strokeStyle','lineWidth','globalAlpha'])Object.defineProperty(ctx,name,{set(value){commands.push({canvas:node.id,name,args:[value]});}});
    node.getContext=()=>ctx;return node;
  }
  const root=events({dataset:{siteWorld:'studio',theme,...(motion?{motion}:{})}}),nebula={style:{}},main=canvas();
  const host={dataset:{},querySelector(selector){return selector==='canvas'?main:selector==='.studio-space-parallax'?nebula:null;}};
  const document=events({documentElement:root,hidden:false,querySelector:selector=>selector==='.studio-space'?host:null,createElement(tag){assert.equal(tag,'canvas');return canvas();}});
  const global=events(),reducedMedia=events({matches:reduced}),fineMedia=events({matches:fine});
  const context={document,Math,innerWidth:width,innerHeight:height,devicePixelRatio:dpr,matchMedia:query=>query.includes('prefers-reduced-motion')?reducedMedia:fineMedia,
    addEventListener:global.addEventListener,requestAnimationFrame:callback=>{frames.set(++serial,callback);return serial;},cancelAnimationFrame:id=>frames.delete(id),
    MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){this.target=target;this.options=options;}}};
  vm.runInNewContext(source,context);
  const take=()=>commands.splice(0);
  function tick(now){assert.equal(frames.size,1,'only one decorative frame may be scheduled');const [callback]=frames.values();frames.clear();callback(now);return take();}
  return {root,main,nebula,document,context,frames,canvases,listeners,reducedMedia,fineMedia,take,tick,emit:global.emit,
    gradientCount:()=>gradientCount,
    mutate(attributeName){for(const observer of observers)observer.callback([{attributeName}]);},
    runAgain(){vm.runInNewContext(source,context);},
    move(x,y,pointerType='mouse'){document.emit('pointermove',{clientX:x,clientY:y,pointerType});},
    click(x,y,pointerType='mouse'){document.emit('pointerdown',{clientX:x,clientY:y,pointerType});}};
}

test('space owns one loop and stops for visibility, scroll, focus and navigation',()=>{
  const f=fixture();assert.equal(f.frames.size,1);
  for(const [pause,resume]of [
    [()=>{f.document.hidden=true;f.document.emit('visibilitychange');},()=>{f.document.hidden=false;f.document.emit('visibilitychange');}],
    [()=>{f.root.dataset.siteScrolling='true';f.emit('raccoon:scrollstate');},()=>{delete f.root.dataset.siteScrolling;f.emit('raccoon:scrollstate');}],
    [()=>f.emit('blur'),()=>f.emit('focus')],
    [()=>f.emit('pagehide'),()=>f.emit('pageshow')]
  ]){
    pause();assert.equal(f.frames.size,0);f.take();f.emit('resize');assert.equal(f.frames.size,0);
    resume();assert.equal(f.frames.size,1);f.tick(100000);assert.equal(f.frames.size,1);
  }
  const before=f.canvases.length;f.runAgain();assert.equal(f.frames.size,1);assert.equal(f.canvases.length,before,'installation is idempotent');
});

test('reduced motion retains a static starfield and disables pointer movement',()=>{
  for(const options of [{reduced:true},{motion:'reduced'}]){
    const f=fixture(options);assert.equal(f.frames.size,0);
    const initial=f.take();assert.ok(initial.some(command=>command.name==='arc'),'the static sky retains stars');
    f.move(250,250);f.click(250,250);f.emit('studio:burst');assert.equal(f.frames.size,0);assert.equal(f.take().length,0);
    f.context.innerWidth=390;f.emit('resize');assert.equal(f.frames.size,0);assert.ok(f.take().some(command=>command.name==='arc'));
  }
  const f=fixture();f.reducedMedia.matches=true;f.reducedMedia.emit('change');assert.equal(f.frames.size,0);
  f.reducedMedia.matches=false;f.reducedMedia.emit('change');assert.equal(f.frames.size,1);
  f.root.dataset.motion='reduced';f.mutate('data-motion');assert.equal(f.frames.size,0);
  delete f.root.dataset.motion;f.mutate('data-motion');assert.equal(f.frames.size,1);
});

test('resize and large displays retain bounded backing pixels and a single frame',()=>{
  const f=fixture({width:7680,height:4320,dpr:3});
  assert.ok(f.main.width*f.main.height<=2400000,'backing pixels stay capped on high-DPI 8K displays');
  assert.ok(f.take().filter(command=>command.canvas===0&&command.name==='arc').length<=190);
  for(let i=0;i<24;i++){
    f.context.innerWidth=320+i*63;f.context.innerHeight=844;f.emit('resize');assert.equal(f.frames.size,1);
    assert.ok(f.main.width<=f.context.innerWidth*1.5+1);f.take();
  }
  f.emit('pagehide');f.emit('resize');assert.equal(f.frames.size,0);
});

test('projection stays finite through long flight and only short foreground streaks are drawn',()=>{
  const f=fixture();f.take();let segments=0;
  for(let i=1;i<=600;i++){
    const commands=f.tick(i*34);let start=null;
    for(const command of commands){
      for(const value of command.args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${command.name} contains a finite coordinate`);
      if(command.name==='moveTo')start=command.args;
      if(command.name==='lineTo'&&start){assert.ok(Math.hypot(command.args[0]-start[0],command.args[1]-start[1])<=20.000001,'foreground streaks cannot cross the viewport');segments++;start=null;}
      if(command.name==='arc')assert.ok(command.args[2]>=0&&command.args[2]<=2.1);
    }
  }
  assert.ok(segments>0,'approaching stars produce flight streaks');
});

test('cursor wake and repeated clicks stay bounded without allocating new glow canvases',()=>{
  const f=fixture();f.take();const allocated=f.canvases.length,gradients=f.gradientCount();
  let sawWake=false,sawRipple=false;
  for(let i=1;i<=180;i++){
    f.move(100+(i%2)*700,150+(i%3)*150);for(let j=0;j<8;j++)f.click(200+j,200+j);
    const commands=f.tick(i*34),particles=commands.filter(command=>command.canvas===0&&command.name==='fillRect'),ellipses=commands.filter(command=>command.name==='ellipse');
    assert.ok(particles.length<=56,'the fixed comet pool is reused');assert.ok(ellipses.length<=8,'at most two pointer arcs and three paired click waves');
    sawWake||=particles.length>0;sawRipple||=ellipses.length>2;
  }
  assert.ok(sawWake&&sawRipple);assert.equal(f.canvases.length,allocated);assert.equal(f.gradientCount(),gradients,'gradients are cached outside the animation loop');
  f.root.emit('pointerleave');const cleared=f.tick(7000);assert.equal(cleared.filter(command=>command.name==='ellipse').length,0);assert.equal(cleared.filter(command=>command.canvas===0&&command.name==='fillRect').length,0);
  for(const listener of f.listeners.filter(listener=>['pointermove','pointerdown'].includes(listener.name)))assert.equal(listener.options?.passive,true);
});

test('touch and coarse pointer input leave the decorative cursor disabled',()=>{
  for(const options of [{fine:false},{}]){
    const f=fixture(options);f.take();f.move(100,100,'touch');f.click(100,100,'touch');f.move(700,400,'touch');
    const commands=f.tick(34);assert.equal(commands.filter(command=>command.name==='ellipse').length,0);assert.equal(commands.filter(command=>command.canvas===0&&command.name==='fillRect').length,0);
  }
  const f=fixture();f.take();f.move(100,100);f.tick(34);f.fineMedia.matches=false;f.fineMedia.emit('change');f.take();
  f.move(600,400);assert.equal(f.tick(68).filter(command=>command.name==='ellipse').length,0);
});

test('theme changes refresh four glow sprites once and frame throttling skips paints',()=>{
  const f=fixture();f.take();const gradients=f.gradientCount();f.tick(100);assert.equal(f.tick(110).length,0,'a sub-32ms frame does not repaint');
  f.root.dataset.theme='light';f.mutate('data-theme');assert.equal(f.gradientCount(),gradients+4);f.take();
  const commands=f.tick(144);assert.ok(commands.some(command=>command.name==='fillStyle'&&['#3f427c','#694789','#2d7379','#876a47'].includes(command.args[0])));
  assert.equal(f.gradientCount(),gradients+4);assert.equal(f.frames.size,1);
});
