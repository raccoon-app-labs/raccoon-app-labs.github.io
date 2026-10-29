import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../plus/step-motion.js',import.meta.url),'utf8');
function fixture(reduced=false){
 const events=()=>{const handlers=new Map();return {addEventListener(n,fn){if(!handlers.has(n))handlers.set(n,[]);handlers.get(n).push(fn);},emit(n,e={}){for(const fn of handlers.get(n)||[])fn(e);}};};
 let now=1000,intersect,mutate,open=false,started=0,cancelled=0,observers=0;const animations=[];
 const element=()=>({...events(),dataset:{},setAttribute(){},classList:{add(){}},prepend(){},append(){},
  querySelector(){return element();},querySelectorAll(){return Array.from({length:4},element);},
  animate(){started++;let resolve;const finished=new Promise(r=>resolve=r);const animation={finished,cancel(){cancelled++;resolve();},finish:resolve};animations.push(animation);return animation;}});
 const cards=Array.from({length:3},()=>{const card=element(),stage=element();stage.querySelectorAll=()=>Array.from({length:3},element);card.querySelector=()=>stage;return card;});
 const section={dataset:{},querySelectorAll:()=>cards},root={dataset:{app:'neon'}};
 const document={...events(),documentElement:root,hidden:false,querySelector:s=>s==='dialog[open]'?(open?{}:null):section,createElement:element};
 const win=events(),media={...events(),matches:reduced},fine={...events(),matches:true};
 const context={document,matchMedia:s=>s.includes('reduced')?media:fine,innerWidth:1200,performance:{now:()=>now},Promise,
  addEventListener:(...args)=>win.addEventListener(...args),
  requestAnimationFrame:()=>assert.fail('No idle animation loop'),setTimeout:()=>assert.fail('No repeating timers'),
  IntersectionObserver:class{constructor(fn){intersect=fn;observers++;}observe(){}},MutationObserver:class{constructor(fn){mutate=fn;}observe(){}}};
 vm.runInNewContext(source,context);
 return {cards,section,root,document,win,media,context,started:()=>started,cancelled:()=>cancelled,observers:()=>observers,async finish(){for(const a of animations)a.finish();await Promise.allSettled(animations.map(a=>a.finished));},
  visible(value){intersect(cards.map(target=>({target,isIntersecting:value,intersectionRatio:value?1:0})));},advance(){now+=2000;},modal(value){open=value;mutate();}};
}
test('step choreography is finite, visible-only and releases all work during scrolling',async()=>{
 const f=fixture();assert.equal(f.started(),0);f.visible(true);assert(f.started()>0);
 assert.equal(new Set(f.cards.map(c=>c.dataset.stepMotion)).size,3);
 const count=f.started();f.root.dataset.siteScrolling='true';f.win.emit('raccoon:scrollstate');assert.equal(f.cancelled(),count);
 delete f.root.dataset.siteScrolling;f.win.emit('raccoon:scrollstate');assert(f.started()>count,'An interrupted entrance resumes after scrolling');await f.finish();const settled=f.started();f.win.emit('raccoon:scrollstate');assert.equal(f.started(),settled,'Completed entrance does not become a continuous loop');
 f.advance();f.cards[0].emit('pointerenter',{pointerType:'mouse'});assert(f.started()>settled);
 f.visible(false);assert(f.cards.every(c=>c.dataset.stepState==='resting'));
});
test('reduced motion, hidden tabs and checkout dialogs suspend decoration without touching buttons',()=>{
 const f=fixture(true);f.visible(true);assert.equal(f.started(),0);
 f.media.matches=false;f.media.emit('change');assert(f.started()>0);f.modal(true);assert(f.cards.every(c=>c.dataset.stepState==='resting'));
 f.modal(false);f.advance();const count=f.started();
 f.cards[0].emit('pointerdown',{pointerType:'touch',target:{closest:()=>({tagName:'BUTTON'})}});assert.equal(f.started(),count,'A purchase tap belongs entirely to checkout');
 f.document.hidden=true;f.document.emit('visibilitychange');f.cards[0].emit('focusin');assert.equal(f.started(),count);
});
test('initializing twice does not add another observer or another set of step effects',()=>{
 const f=fixture();vm.runInNewContext(source,f.context);assert.equal(f.observers(),1);
});
