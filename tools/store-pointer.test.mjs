import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../plus/effects.js',import.meta.url),'utf8')
  .replace(/^import[^\n]+\n/, 'const installComicPointer=()=>({clear(){}});\n')
  .replace('export function installStoreEffects','function installStoreEffects');

function fixture(app,atmosphere='hanzi'){
  const listeners=()=>{const handlers=new Map();return {
    addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},
    emit(name,event={}){for(const fn of handlers.get(name)||[])fn(event);}
  };};
  const root={...listeners(),dataset:{app,paymentAtmosphere:atmosphere,theme:'dark'}};
  const canvases=[],frames=new Map();let serial=0,animations=0,clears=0;
  const win=listeners();
  class Element{}
  const control=new Element();
  Object.assign(control,{closest:()=>control,matches:()=>false,classList:{add(){},remove(){}},
    getBoundingClientRect:()=>({left:0,top:0,width:100,height:40}),
    animate(){animations++;return {finished:new Promise(()=>{}),cancel(){}};}});
  const document={...listeners(),documentElement:root,hidden:false,querySelectorAll:()=>[],
    body:{append:node=>canvases.push(node)},createElement:()=>({setAttribute(){},getContext:()=>({setTransform(){},clearRect(){clears++;}})})};
  const context={document,window:win,Element,performance:{now:()=>100},innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    getComputedStyle:()=>({getPropertyValue:()=>'#fff'}),
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(source+'\ninstallStoreEffects({reducedMotion:()=>false,finePointer:{matches:true}});',context);
  const event={target:control,isPrimary:true,pointerType:'mouse',clientX:100,clientY:200,button:0,detail:1};
  return {root,canvases,frames,move:()=>document.emit('pointermove',event),
    click:()=>{document.emit('pointerdown',event);document.emit('click',event);},
    change:next=>{root.dataset.app=next;win.emit('raccoon:appchange');},animations:()=>animations,clears:()=>clears};
}

test('Stories keeps its fireflies without the shared movement trail or click particles',()=>{
  for(const [app,atmosphere] of [['stories','hanzi'],['stories','stories'],[undefined,'stories']]){
    const f=fixture(app,atmosphere);f.move();f.click();
    assert.equal(f.canvases.length,0,'no shared particle canvas');
    assert.equal(f.frames.size,0,'no shared particle animation loop');
    assert.equal(f.animations(),2,'button press and click feedback remains');
  }
});

test('switching from Hanzi to Stories clears existing particles and does not start another trail',()=>{
  for(const app of ['bloom','keys']){
    const f=fixture(app);f.move();assert.equal(f.canvases.length,1);assert.equal(f.frames.size,1);
    f.change('stories');assert.equal(f.frames.size,0);assert.ok(f.clears()>0);
    f.move();f.click();assert.equal(f.frames.size,0);
    f.change(app);f.move();assert.equal(f.frames.size,1,'Hanzi trail still works after returning');
  }
});

test('Neon continues to use its own comic pointer instead of the shared trail',()=>{
  const f=fixture('neon');f.move();f.click();assert.equal(f.canvases.length,0);assert.equal(f.frames.size,0);
});
