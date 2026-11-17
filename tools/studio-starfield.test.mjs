import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(process.env.STUDIO_MOTION_SOURCE || new URL('../assets/studio-motion.js',import.meta.url),'utf8');
const digest=commands=>createHash('sha256').update(JSON.stringify(commands)).digest('hex');
export function starfield(source,{width=390,height=844,reduced=false,fine=false,theme='dark',countDistances=true}={}){
  const commands=[],frames=new Map(),timers=new Map(),canvases=[],listeners=[],observers=[],stats={hypot:0,gradients:0};let serial=0;
  const events=()=>{const handlers=new Map();return {addEventListener(name,fn,options){listeners.push({name,options});if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},emit(name,data={}){for(const fn of handlers.get(name)||[])fn(data);}};};
  const element=tag=>({...events(),tag,style:{},dataset:{},children:[],classList:{add(){},remove(){},toggle(){}},firstChild:null,append(...children){this.children.push(...children);},setAttribute(){},removeAttribute(){}});
  const root={...events(),dataset:{siteWorld:'studio',theme},lang:'ru'},visual=element('div'),core=element('div');visual.querySelector=()=>core;
  const media={...events(),matches:reduced},fineMedia={...events(),matches:fine},globalEvents=events();
  const document={...events(),documentElement:root,hidden:false,querySelector:selector=>selector==='.visual'?visual:null,querySelectorAll:()=>[],body:{prepend(){}},createElement(tag){
    const node=element(tag);if(tag!=='canvas')return node;
    const id=canvases.length;canvases.push(node);
    for(const key of ['width','height'])Object.defineProperty(node,key,{set:value=>commands.push([id,key,value])});
    const ctx={};for(const key of ['fillStyle','strokeStyle','lineWidth','globalAlpha'])Object.defineProperty(ctx,key,{set:value=>commands.push([id,key,value])});
    for(const name of ['setTransform','clearRect','fillRect','beginPath','arc','fill','moveTo','lineTo','stroke','quadraticCurveTo','ellipse'])ctx[name]=(...args)=>commands.push([id,name,...args]);
    ctx.drawImage=(sprite,...args)=>commands.push([id,'drawImage',canvases.indexOf(sprite),...args]);
    ctx.createRadialGradient=(...args)=>{stats.gradients++;commands.push([id,'createRadialGradient',...args]);return {addColorStop:(...args)=>commands.push([id,'addColorStop',...args])};};
    node.getContext=()=>ctx;return node;
  }};
  const math=Object.create(Math);math.hypot=(...args)=>{stats.hypot++;return Math.hypot(...args);};
  class Observer{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){}}
  const context={document,Math:countDistances?math:Math,IntersectionObserver:Observer,MutationObserver:Observer,matchMedia:query=>query.includes('prefers-reduced-motion')?media:fineMedia,innerWidth:width,innerHeight:height,devicePixelRatio:2,scrollY:0,
    addEventListener:globalEvents.addEventListener,requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  return {commands,stats,frames,root,document,media,fineMedia,canvases,listeners,context,emit:globalEvents.emit,
    mutate(name){for(const observer of observers)if(observer.target===root&&observer.options?.attributeFilter?.includes(name))observer.callback([{attributeName:name}]);},
    burst(){core.children[0].emit('click');},
    tick(now){assert.ok(frames.size>0,'a frame is scheduled');const jobs=[...frames.values()];frames.clear();for(const fn of jobs)fn(now);},
    take(){const result={hash:digest(commands),commands:commands.length,hypot:stats.hypot};commands.length=0;stats.hypot=0;return result;}};
}
export function scenario(source,viewport){
  const f=starfield(source,viewport),results=[f.take()];
  f.tick(34);results.push(f.take());
  f.document.emit('pointermove',{clientX:110,clientY:240});f.tick(68);results.push(f.take());
  f.burst();f.tick(102);results.push(f.take());
  f.root.dataset.theme='light';f.tick(136);results.push(f.take());
  f.context.scrollY=520;f.tick(170);results.push(f.take());
  f.context.innerWidth=412;f.context.innerHeight=915;f.emit('resize');results.push(f.take());
  f.root.emit('pointerleave');f.tick(204);results.push(f.take());
  f.media.matches=true;f.media.emit('change');results.push(f.take());
  f.context.scrollY=1000;f.emit('scroll');results.push(f.take());
  f.media.matches=false;f.media.emit('change');results.push(f.take());
  f.document.hidden=true;f.document.emit('visibilitychange');results.push(f.take());
  f.document.hidden=false;f.document.emit('visibilitychange');f.tick(238);results.push(f.take());
  f.root.dataset.siteScrolling='true';f.emit('raccoon:scrollstate');results.push(f.take());
  delete f.root.dataset.siteScrolling;f.emit('raccoon:scrollstate');f.tick(272);results.push(f.take());
  f.emit('pagehide');results.push(f.take());f.emit('pageshow');f.tick(306);results.push(f.take());
  return results;
}
// Regression tests
// Canvas commands recorded from the renderer at df3f88c, before the CPU changes.
const expected={"390":[{"hash":"abb6ea2577121c5fa35b89cdf6ff368a26dd1df7586e8bf2522271a5a4389519","commands":738},{"hash":"44d8539861706c9aefd8ce384b8139da8a1335fd5f61f875ba85ef2aa62141ff","commands":717},{"hash":"13bab3cf58196232d2c75e3eac47078dd149fc067586fccffb756028a568bd15","commands":754},{"hash":"3cfc7b61d0d7d5e9ad4773de2f59fee6a19f7f88578c63d0dee3bb0ddce742af","commands":754},{"hash":"0bf84c80b1034f4d7e0565f426e286767f4498b84a56c1224c14cd5e1ecfc6dd","commands":772},{"hash":"5aaaae20db4f173c4f94c19769141a1424a2802059fde573b1b3175abd713478","commands":754},{"hash":"b25e0bf5b1e7d4ef322b8457791992e0a057d77d082990d0e45ae31f4c48326b","commands":665},{"hash":"7807c62d0c8da8b62a1836e5bcb30fca69f7d2ef556844cf04564078ed2cc98e","commands":635},{"hash":"03e05aa411606dabe9ff84c333c5b6727e23bb1dc9079ae99615a112e7c9f0d6","commands":635},{"hash":"301f71c409d86456dc8b2667bd00bdac5ed70f05feae97f7000945c50b576ab9","commands":635},{"hash":"e57af782ec1016553273a6c915187ff1244cdba65f56e2de59fa1910b4d888ac","commands":635},{"hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","commands":0},{"hash":"bbcdaace2235f537be0b52973196383735bd0bed573ee1d3df312ac12469c86c","commands":635},{"hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","commands":0},{"hash":"d10bcfc45d5aa667993b0a8a47250b8b62a1b7114f21744eb3da84254a509951","commands":635},{"hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","commands":0},{"hash":"44ec3b894abcb4d2e086b005a03f0bb050d9c61ed6ea7033bffa6bbd85a2a4b8","commands":635}],"1280":[{"hash":"b49402430b8713ad7e38a591fe9eefbc23f9a988f458140dc450ad8a0612a998","commands":638},{"hash":"dc8266939bfe27e2e84b4ba0309cbbb7d35e37d991b5ac40d8ae069a00c39c6c","commands":617},{"hash":"e86e4f546e8b739dbce748092a7e01e778b941fbd6178b5de83e355c3c4b985d","commands":626},{"hash":"038a5fd93339769f0bf7f323ee89cfc863647d2bd354a8783ab554153eef152b","commands":626},{"hash":"ff0f512789fc29e59c4bdca5579d0a4652b99d8a0a7becf1255a0ce157de2aaf","commands":644},{"hash":"45c3f5839023868d8e2985f85dfd5da4ba0dbe3451944a2314a161cae6c7ab5e","commands":626},{"hash":"b25e0bf5b1e7d4ef322b8457791992e0a057d77d082990d0e45ae31f4c48326b","commands":665},{"hash":"7807c62d0c8da8b62a1836e5bcb30fca69f7d2ef556844cf04564078ed2cc98e","commands":635},{"hash":"03e05aa411606dabe9ff84c333c5b6727e23bb1dc9079ae99615a112e7c9f0d6","commands":635},{"hash":"301f71c409d86456dc8b2667bd00bdac5ed70f05feae97f7000945c50b576ab9","commands":635},{"hash":"e57af782ec1016553273a6c915187ff1244cdba65f56e2de59fa1910b4d888ac","commands":635},{"hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","commands":0},{"hash":"bbcdaace2235f537be0b52973196383735bd0bed573ee1d3df312ac12469c86c","commands":635},{"hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","commands":0},{"hash":"d10bcfc45d5aa667993b0a8a47250b8b62a1b7114f21744eb3da84254a509951","commands":635},{"hash":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","commands":0},{"hash":"44ec3b894abcb4d2e086b005a03f0bb050d9c61ed6ea7033bffa6bbd85a2a4b8","commands":635}]};
test('the starfield retains every canvas command through pointer, burst, theme, resize and lifecycle transitions',()=>{
  for(const width of [390,1280])assert.deepEqual(scenario(source,{width,height:844}).map(({hash,commands})=>({hash,commands})),expected[width]);
});
test('hidden, scrolling and closed pages do not schedule decorative frames',()=>{
  const f=starfield(source);f.document.hidden=true;f.document.emit('visibilitychange');assert.equal(f.frames.size,0);
  f.document.hidden=false;f.document.emit('visibilitychange');assert.equal(f.frames.size,1);
  f.root.dataset.siteScrolling='true';f.emit('raccoon:scrollstate');assert.equal(f.frames.size,0);
  delete f.root.dataset.siteScrolling;f.emit('raccoon:scrollstate');assert.equal(f.frames.size,1);
  f.emit('pagehide');assert.equal(f.frames.size,0);f.emit('pageshow');assert.equal(f.frames.size,1);
  f.media.matches=true;f.media.emit('change');assert.equal(f.frames.size,0);
});
test('repeated viewport changes keep one frame and release it on hide, reduced motion and navigation',()=>{
  const f=starfield(source);assert.equal(f.frames.size,1);
  for(let i=0;i<20;i++){f.context.innerWidth=390+i;f.emit('resize');assert.equal(f.frames.size,1);}
  f.tick(34);assert.equal(f.frames.size,1);
  f.document.hidden=true;f.document.emit('visibilitychange');f.emit('resize');assert.equal(f.frames.size,0);
  f.document.hidden=false;f.document.emit('visibilitychange');assert.equal(f.frames.size,1);
  f.media.matches=true;f.media.emit('change');f.emit('resize');assert.equal(f.frames.size,0);
  f.media.matches=false;f.media.emit('change');assert.equal(f.frames.size,1);
  f.emit('pagehide');f.emit('resize');assert.equal(f.frames.size,0);
  f.emit('pageshow');assert.equal(f.frames.size,1);
});

const curves=f=>f.commands.filter(command=>command[1]==='quadraticCurveTo');
const waves=f=>f.commands.filter(command=>command[1]==='ellipse');
const move=(f,x=620,y=350,type='mouse')=>f.document.emit('pointermove',{clientX:x,clientY:y,pointerType:type});
const click=(f,x=620,y=350,type='mouse')=>f.document.emit('pointerdown',{clientX:x,clientY:y,pointerType:type});

test('fine pointers create local curves and at most two short click waves',()=>{
  const f=starfield(source,{width:1280,fine:true});f.take();move(f);for(let i=0;i<120;i++)click(f);
  assert.equal(f.frames.size,1,'input shares the existing background loop');f.tick(34);
  const ribbons=curves(f),ripples=waves(f);assert.ok(ribbons.length>0&&ribbons.length<=32);assert.ok(ripples.length>0&&ripples.length<=2);
  for(const command of ribbons)for(let i=2;i<command.length;i+=2){assert.ok(Math.abs(command[i]-620)<=100);assert.ok(Math.abs(command[i+1]-350)<=65);}
  for(const command of ripples){assert.equal(command[2],620);assert.equal(command[3],350);assert.ok(command[4]<=120&&command[5]<=70);}
  for(const command of f.commands)for(const value of command.slice(2))if(typeof value==='number')assert.ok(Number.isFinite(value));
  for(const listener of f.listeners.filter(listener=>['pointermove','pointerdown'].includes(listener.name)))assert.equal(listener.options?.passive,true);
});

test('pointer effects fade after inactivity and reuse the original cached glow canvases',()=>{
  const f=starfield(source,{width:1280,fine:true});f.take();const allocated=f.canvases.length,gradients=f.stats.gradients;
  for(let i=1;i<=100;i++){move(f,600+Math.sin(i)*50,350+Math.cos(i)*30);click(f);f.tick(i*34);assert.ok(waves(f).length<=2);f.take();}
  assert.equal(f.canvases.length,allocated);assert.equal(f.stats.gradients,gradients,'no per-frame gradients');
  for(let i=101;i<=160;i++){f.tick(i*34);if(i<160)f.take();}
  assert.equal(curves(f).length,0,'resting pointer no longer renders ribbons');assert.equal(waves(f).length,0,'click waves expire');
  assert.equal(f.frames.size,1,'the unchanged ambient background retains its single loop');
});

test('coarse and touch input do not create the extra pointer field; reduced motion remains static',()=>{
  for(const options of [{fine:false},{fine:true}]){
    const f=starfield(source,options);f.take();const type=options.fine?'touch':'mouse';move(f,200,250,type);click(f,200,250,type);f.tick(34);
    assert.equal(curves(f).length,0);assert.equal(waves(f).length,0);
  }
  const f=starfield(source,{fine:true,reduced:true});f.take();move(f);click(f);assert.equal(f.frames.size,0);assert.equal(f.commands.length,0);
});

test('blur, scrolling, hiding and navigation clear live effects and never duplicate a frame',()=>{
  for(const [pause,resume]of [
    [f=>f.emit('blur'),f=>f.emit('focus')],
    [f=>{f.root.dataset.siteScrolling='true';f.emit('raccoon:scrollstate');},f=>{delete f.root.dataset.siteScrolling;f.emit('raccoon:scrollstate');}],
    [f=>{f.document.hidden=true;f.document.emit('visibilitychange');},f=>{f.document.hidden=false;f.document.emit('visibilitychange');}],
    [f=>f.emit('pagehide'),f=>f.emit('pageshow')]
  ]){
    const f=starfield(source,{fine:true});f.take();move(f);click(f);f.tick(34);assert.ok(curves(f).length);f.take();
    pause(f);assert.equal(f.frames.size,0);move(f);click(f);assert.equal(f.frames.size,0);
    resume(f);assert.equal(f.frames.size,1);f.tick(68);assert.equal(curves(f).length,0);assert.equal(waves(f).length,0);
    for(let i=0;i<8;i++){f.emit('resize');assert.equal(f.frames.size,1);}
  }
});

test('motion override and pointer capability changes clear the active field',()=>{
  const f=starfield(source,{fine:true});f.take();move(f);click(f);f.tick(34);assert.ok(curves(f).length);f.take();
  f.root.dataset.motion='reduced';f.mutate('data-motion');assert.equal(f.frames.size,0);assert.equal(curves(f).length,0);assert.equal(waves(f).length,0);
  f.take();delete f.root.dataset.motion;f.mutate('data-motion');assert.equal(f.frames.size,1);f.take();move(f);f.tick(68);assert.ok(curves(f).length);f.take();
  f.fineMedia.matches=false;f.fineMedia.emit('change');f.tick(102);assert.equal(curves(f).length,0);assert.equal(waves(f).length,0);
});
