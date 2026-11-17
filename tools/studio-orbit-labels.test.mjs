import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {captionLayout} from '../assets/studio-orbit-labels.mjs';

const source=readFileSync(new URL('../assets/studio-orbit-labels.mjs',import.meta.url),'utf8').replace(/^export /gm,'');

function target(){
  const handlers=new Map();
  return {addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},
    emit(name,event={}){for(const fn of handlers.get(name)||[])fn(event);}};
}

function element(className=''){
  const attrs=new Map(),classes=new Set();
  const node={...target(),className,dataset:{},children:[],parent:null,style:{setProperty(key,value){this[key]=value;}},
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
    setAttribute:(key,value)=>attrs.set(key,String(value)),getAttribute:key=>attrs.get(key),
    toggleAttribute(key,on){if(on)attrs.set(key,'');else attrs.delete(key);},hasAttribute:key=>attrs.has(key),
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}},
    replaceChildren(...children){this.children=[];this._text='';this.append(...children);},
    querySelector(selector){return this.children.find(child=>selector==='a'?child.tagName==='A':child.className===selector.slice(1))||null;},
    closest(selector){return this.className===selector.slice(1)?this:this.parent?.closest(selector)||null;},
    getBoundingClientRect:()=>({width:280,height:280,top:180,left:20}),offsetWidth:190,offsetHeight:68};
  Object.defineProperty(node,'textContent',{get(){return (this._text||'')+this.children.map(child=>child.textContent).join('');},set(value){this._text=String(value);this.children=[];}});
  return node;
}

function fixture({reduced=false}={}){
  const timers=new Map(),observers={},root=element(),visual=element('visual');let serial=0;
  // Keep module auto-mount out of this fixture; exercise the exported initializer.
  root.dataset.siteWorld='test';
  const carriers=Array.from({length:7},()=>{const carrier=element('studio-satellite'),link=element();link.tagName='A';carrier.append(link);visual.append(carrier);return carrier;});
  visual.querySelectorAll=()=>carriers;
  const document={...target(),documentElement:root,hidden:false,querySelector:()=>null,
    createElement:()=>element(),createTextNode:value=>({textContent:value})};
  let language='en';
  const window={...target(),HanziLocale:{t:name=>language==='ar'?'قصص سحرية':name}};
  const media={...target(),matches:reduced};
  const observer=name=>class{constructor(callback){observers[name]=callback;}observe(){}};
  const context={document,window,matchMedia:()=>media,MutationObserver:observer('settings'),
    IntersectionObserver:observer('visible'),ResizeObserver:observer('resize'),scrollY:0,innerHeight:844,
    setTimeout(fn,delay){assert.equal(delay,4200);timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  const controller=context.createOrbitCaptions(visual),caption=visual.children.find(node=>node.className==='studio-caption');
  return {root,visual,carriers,document,window,media,timers,controller,caption,
    active:()=>carriers.findIndex(node=>node.hasAttribute('data-caption-active')),
    visible(value){observers.visible([{isIntersecting:value}]);},
    settings(){observers.settings();},
    language(value){language=value;window.emit('hanzi:languagechange');},
    tick(){assert.equal(timers.size,1);const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}

test('one visible caption cycles with one timer and keyboard focus wins over hover',()=>{
  const f=fixture();assert.equal(f.active(),2);assert.equal(f.timers.size,0);
  f.visible(true);assert.equal(f.timers.size,1);f.tick();assert.equal(f.active(),3);assert.equal(f.timers.size,1);
  f.visual.emit('focusin',{target:f.carriers[1].children[0]});assert.equal(f.active(),1);assert.equal(f.timers.size,0);
  f.visual.emit('pointerover',{target:f.carriers[4].children[0],pointerType:'mouse'});assert.equal(f.active(),1);
  f.visual.emit('pointerout',{target:f.carriers[4].children[0],relatedTarget:f.carriers[5].children[0],pointerType:'mouse'});
  assert.equal(f.active(),1,'moving between hovered satellites must not override keyboard focus');
  f.visual.emit('focusout',{relatedTarget:null});assert.equal(f.active(),5);assert.equal(f.timers.size,0);
  f.visual.emit('pointerout',{target:f.carriers[5].children[0],relatedTarget:null,pointerType:'mouse'});assert.equal(f.timers.size,1);
});

test('reduced motion preserves a readable label without automatic cycling',()=>{
  const f=fixture({reduced:true});f.visible(true);assert.equal(f.timers.size,0);assert.equal(f.caption.classList.contains('is-revealing'),false);
  f.media.matches=false;f.media.emit('change');assert.equal(f.timers.size,1);
  f.root.dataset.motion='reduced';f.settings();assert.equal(f.timers.size,0);assert.equal(f.caption.classList.contains('is-revealing'),false);
  delete f.root.dataset.motion;f.settings();assert.equal(f.timers.size,1);
  f.media.matches=true;f.media.emit('change');assert.equal(f.timers.size,0);
});

test('hidden, offscreen, scrolling and page navigation release the automatic timer',()=>{
  const f=fixture();f.visible(true);
  f.document.hidden=true;f.document.emit('visibilitychange');assert.equal(f.timers.size,0);
  f.document.hidden=false;f.document.emit('visibilitychange');assert.equal(f.timers.size,1);
  f.visible(false);assert.equal(f.timers.size,0);assert.equal(f.caption.style.visibility,'hidden');
  f.visible(true);assert.equal(f.timers.size,1);
  f.root.dataset.siteScrolling='true';f.window.emit('raccoon:scrollstate');assert.equal(f.timers.size,0);
  delete f.root.dataset.siteScrolling;f.window.emit('raccoon:scrollstate');assert.equal(f.timers.size,1);
  f.window.emit('pagehide');assert.equal(f.timers.size,0);
  f.window.emit('pageshow');assert.equal(f.timers.size,1);
});

test('language changes refresh accessible names and preserve Arabic shaping',()=>{
  const f=fixture();f.language('ar');
  for(const carrier of f.carriers)assert.equal(carrier.children[0].getAttribute('aria-label'),'قصص سحرية');
  const title=f.caption.children.find(node=>node.className==='studio-caption-title');
  assert.equal(title.textContent,'قصص سحرية');assert.equal(title.children.length,0,'Arabic must remain one shaped text run');
  assert.equal(f.caption.getAttribute('aria-hidden'),'true');
});

test('caption remains within a 320px viewport through a complete orbit and flips rails near an edge',()=>{
  const width=280,labelWidth=208;
  for(let angle=0;angle<Math.PI*2;angle+=.03){
    const layout=captionLayout(Math.cos(angle)*140,Math.sin(angle)*140,width,width,labelWidth,76);
    assert.ok(layout.left>=6);assert.ok(layout.left+labelWidth<=width-6);assert.ok(Number.isFinite(layout.length));
  }
  const topClipped=captionLayout(0,-110,width,width,labelWidth,76,-40,500);
  assert.equal(topClipped.top,width+16,'use bottom rail when top caption would leave the viewport');
  const bottomClipped=captionLayout(0,110,width,width,labelWidth,76,-200,320);
  assert.equal(bottomClipped.top,-92,'use top rail when bottom caption would leave the viewport');
});
