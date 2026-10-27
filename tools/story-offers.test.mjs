import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/commerce/story-offers.js',import.meta.url),'utf8');

function fixture(){
  const events=()=>{
    const handlers=new Map();
    return {addEventListener(name,callback){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(callback);},emit(name,event={}){for(const callback of handlers.get(name)||[])callback(event);}};
  };
  const style=()=>{const values=new Map();return{setProperty:(name,value)=>values.set(name,value),removeProperty:name=>values.delete(name),getPropertyValue:name=>values.get(name)||''};};
  let reads=0,serial=0,now=0;const raf=new Map(),mutations=[];
  const root={dataset:{app:'stories'}},panel={hidden:false};
  const makeCard=(ticket,index,geometry={})=>{
    const card={style:style(),dataset:{},matches:selector=>ticket && selector==='.offer-card',prepend(){},offsetParent:null};
    for(const [key,value] of Object.entries({offsetTop:ticket?100:450,offsetLeft:100+index*400,offsetWidth:300,offsetHeight:220,...geometry}))Object.defineProperty(card,key,{get(){reads++;return value;}});
    return card;
  };
  const makeGrid=(ticket,count)=>{
    const cards=Array.from({length:count},(_,index)=>makeCard(ticket,index));
    return{...events(),cards,dataset:{},closest:()=>panel,querySelectorAll:()=>cards,matches:selector=>selector===(ticket?'.offer-grid':'.commerce-details')};
  };
  const offers=makeGrid(true,2),details=makeGrid(false,3);
  const how=Object.assign(makeCard(false,0,{offsetTop:740,offsetWidth:1100,offsetHeight:280}),events(),{closest:()=>panel,matches:selector=>selector==='.commerce-get'});
  const doc={...events(),documentElement:root,hidden:false,querySelectorAll:()=>[offers,details,how],querySelector:()=>null,createElement:()=>({style:style(),setAttribute(){},append(){}}),fonts:{ready:{then:callback=>callback()}}};
  const context={...events(),document:doc,scrollX:0,scrollY:0,innerHeight:800,matchMedia:query=>({matches:query.includes('pointer: fine'),addEventListener(){}}),
    requestAnimationFrame:callback=>{raf.set(++serial,callback);return serial;},cancelAnimationFrame:id=>raf.delete(id),
    ResizeObserver:class{observe(){}},MutationObserver:class{constructor(callback){mutations.push(callback);}observe(){}}};
  vm.runInNewContext(source,context);
  const pump=(count=260)=>{for(let i=0;i<count && raf.size;i++){now+=16.667;const batch=[...raf.values()];raf.clear();batch.forEach(callback=>callback(now));}};
  const move=(grid,x,y,pointerType='mouse')=>grid.emit('pointermove',{clientX:x,clientY:y,pointerType});
  const value=(card,name)=>parseFloat(card.style.getPropertyValue('--offer-'+name))||0;
  pump();return{offers,details,how,root,context,mutations,pump,move,value,reads:()=>reads,pending:()=>raf.size};
}

test('information cards follow the pointer gently without measuring layout or running an idle loop',()=>{
  const f=fixture(),card=f.details.cards[0],reads=f.reads();
  f.move(f.details,130,470);f.pump();
  assert.ok(f.value(card,'tilt-x')>0 && f.value(card,'tilt-x')<=2.6);
  assert.ok(f.value(card,'tilt-y')<0 && f.value(card,'tilt-y')>=-3.6);
  assert.equal(f.value(card,'lift'),-2.5);
  assert.equal(f.value(card,'pointer-light'),1);
  assert.equal(f.value(card,'pointer-x'),10);
  assert.equal(f.value(f.offers.cards[0],'pointer-light'),0,'the purchase panels must not respond to another group');
  f.move(f.details,380,650);f.pump();
  assert.ok(f.value(card,'tilt-x')<0 && f.value(card,'tilt-y')>0);
  assert.equal(f.reads(),reads,'pointer movement must reuse the stationary card geometry');
  assert.equal(f.pending(),0,'a settled hover must stop requesting frames');
});

test('information cards return smoothly on leave and scroll, and honor reduced motion and touch',()=>{
  const f=fixture(),card=f.details.cards[0];
  f.move(f.details,130,470);f.pump();
  f.details.emit('pointerleave');f.pump(1);
  assert.ok(f.value(card,'pointer-light')>0 && f.value(card,'pointer-light')<1,'leaving should fade rather than snap');
  f.pump();assert.equal(f.value(card,'tilt-x'),0);assert.equal(f.value(card,'pointer-light'),0);
  assert.equal(f.details.dataset.offerTilt,'resting');assert.equal(f.pending(),0);
  f.move(f.details,130,470);f.pump();f.context.emit('scroll');f.pump();
  assert.equal(f.value(card,'pointer-light'),0,'scrolling releases the detail group');
  f.move(f.details,130,470,'touch');f.pump();assert.equal(f.value(card,'pointer-light'),0);
  f.move(f.details,130,470);f.pump();f.root.dataset.motion='reduced';f.mutations[0]();f.pump();
  assert.equal(f.details.dataset.offerMotion,'reduced');assert.equal(f.value(card,'tilt-y'),0);
  f.move(f.details,380,650);assert.equal(f.pending(),0);
});

test('purchase panels keep their pointer tilt and scroll reveal',()=>{
  const f=fixture(),card=f.offers.cards[0],progress=card.dataset.offerProgress;
  f.move(f.offers,120,120);f.pump();
  assert.ok(f.value(card,'tilt-x')>0 && f.value(card,'tilt-y')<0);
  assert.equal(f.value(card,'lift'),-4);assert.equal(f.value(f.details.cards[0],'pointer-light'),0);
  f.context.scrollY=100;f.context.emit('scroll');f.pump();
  assert.notEqual(card.dataset.offerProgress,progress);
  assert.equal(f.value(card,'pointer-light'),1,'scroll reveal keeps the original ticket hover behavior');
  f.root.dataset.app='bloom';f.mutations[0]();f.pump();
  assert.equal(card.style.getPropertyValue('--offer-tilt-x'),'');assert.equal(f.pending(),0);
});

test('the instructions panel tilts as one surface and releases smoothly without an idle loop',()=>{
  const f=fixture(),card=f.how,reads=f.reads();
  f.move(card,130,770);f.pump();
  assert.ok(f.value(card,'tilt-x')>0 && f.value(card,'tilt-y')<0);
  assert.equal(f.value(card,'pointer-light'),1);
  assert.equal(f.value(f.details.cards[0],'pointer-light'),0);
  assert.equal(f.value(f.offers.cards[0],'pointer-light'),0);
  f.move(card,1100,1000);f.pump();
  assert.ok(f.value(card,'tilt-x')<0 && f.value(card,'tilt-y')>0);
  assert.equal(f.reads(),reads);assert.equal(f.pending(),0);
  f.context.emit('scroll');f.pump(1);
  assert.ok(f.value(card,'pointer-light')>0 && f.value(card,'pointer-light')<1);
  f.pump();assert.equal(f.value(card,'tilt-x'),0);assert.equal(f.value(card,'pointer-light'),0);
  assert.equal(card.dataset.offerTilt,'resting');assert.equal(f.pending(),0);
  f.move(card,130,770);f.pump();f.root.dataset.motion='reduced';f.mutations[0]();f.pump();
  assert.equal(f.value(card,'tilt-y'),0);assert.equal(card.dataset.offerMotion,'reduced');
});
