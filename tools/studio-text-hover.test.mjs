import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/studio-text-hover.js',import.meta.url),'utf8');

function fixture({title='Mobile apps',second='and games.',fine=true,reduced=false}={}){
  const frames=new Map(),timers=new Map(),mutations=[],resizes=[],intersections=[];let serial=0,selection=false,styleReads=0;
  const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
  function events(node={}){const handlers=new Map();return Object.assign(node,{addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},emit(name,event={}){for(const fn of handlers.get(name)||[])fn(event);}});}
  class Text{constructor(data){this.nodeType=3;this.data=data;}get textContent(){return this.data;}cloneNode(){return new Text(this.data);}}
  class Element{
    constructor(tag){events(this);this.nodeType=1;this.tagName=tag.toUpperCase();this.dataset={};this.attrs=new Map();this.childNodes=[];this.parentElement=null;this.reads=0;this.style={setProperty(key,value){this[key]=value;}};}
    append(...nodes){for(const node of nodes){node.parentElement=this;this.childNodes.push(node);}}
    get textContent(){return this.childNodes.map(node=>node.textContent).join('');}
    set textContent(value){this.childNodes=[];this.append(new Text(String(value)));}
    hasAttribute(name){return name.startsWith('data-')?Object.hasOwn(this.dataset,dataKey(name)):this.attrs.has(name);}
    setAttribute(name,value){if(name.startsWith('data-'))this.dataset[dataKey(name)]=value;else this.attrs.set(name,value);}
    getAttribute(name){return name.startsWith('data-')?this.dataset[dataKey(name)]??null:this.attrs.get(name)??null;}
    removeAttribute(name){if(name.startsWith('data-'))delete this.dataset[dataKey(name)];else this.attrs.delete(name);}
    closest(selector){for(let node=this;node;node=node.parentElement)if(selector==='[data-studio-echo]'&&node.hasAttribute('data-studio-echo'))return node;return null;}
    querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.childNodes){if(child.nodeType!==1)continue;if(selector==='[id]'&&child.hasAttribute('id'))result.push(child);visit(child);}};visit(this);return result;}
    cloneNode(deep=false){const clone=new Element(this.tagName);clone.className=this.className;clone.dataset={...this.dataset};clone.attrs=new Map(this.attrs);Object.assign(clone.style,this.style);if(deep)clone.append(...this.childNodes.map(node=>node.cloneNode(true)));return clone;}
    remove(){if(this.parentElement)this.parentElement.childNodes=this.parentElement.childNodes.filter(node=>node!==this);this.parentElement=null;}
    getBoundingClientRect(){this.reads++;return {left:20,top:100,right:620,bottom:300,width:600,height:200};}
  }
  const root=new Element('html');root.dataset.siteWorld='studio';root.lang='en';
  const heading=new Element('h1'),first=new Text(title),br=new Element('br'),gradient=new Element('span'),secondText=new Text(second),intro=new Element('p'),signal=new Element('a');
  gradient.className='gradient-word';gradient.setAttribute('id','localized-gradient');gradient.append(secondText);heading.append(first,br,gradient);intro.textContent='Readable original description';signal.textContent='Explore the projects';root.append(heading,intro,signal);
  const document=events({documentElement:root,hidden:false,createElement:tag=>new Element(tag),querySelectorAll(selector){return selector.includes('.hero-copy h1')?[heading]:selector.includes('.hero-copy .intro')?[intro]:[signal];}});
  const window=events({getSelection:()=>({isCollapsed:!selection})});
  const fineMedia=events({matches:fine}),motionMedia=events({matches:reduced});
  function observer(list){return class{constructor(callback){this.callback=callback;this.targets=[];list.push(this);}observe(target){this.targets.push(target);}};}
  const context={document,window,MutationObserver:observer(mutations),ResizeObserver:observer(resizes),IntersectionObserver:observer(intersections),
    matchMedia:query=>query.includes('pointer: fine')?fineMedia:motionMedia,
    getComputedStyle(){styleReads++;return {fontSize:'90px',color:'rgb(250,241,255)'};},
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  const move=(target=heading,type='mouse',x=250,y=180)=>target.emit('pointermove',{pointerType:type,clientX:x,clientY:y});
  const tick=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(1000);};
  const echoes=()=>heading.childNodes.filter(node=>node.hasAttribute?.('data-studio-echo'));
  return {root,heading,first,br,gradient,secondText,intro,signal,document,window,frames,timers,fineMedia,motionMedia,move,tick,echoes,styleReads:()=>styleReads,
    select(value){selection=value;document.emit('selectionchange');},
    mutate(){for(const observer of mutations)if(observer.targets.includes(heading))observer.callback([{type:'characterData',target:first,addedNodes:[],removedNodes:[]}]);},
    offscreen(){for(const observer of intersections)observer.callback([{target:heading,isIntersecting:false}]);},
    runAgain(){vm.runInNewContext(source,context);}};
}

test('hover preserves original multilingual nodes, gradient markup and accessible text',()=>{
  for(const [title,second]of [['Mobile apps','and games.'],['Мобильные приложения','и игры.'],['تطبيقات محمولة','وألعاب.'],['मोबाइल ऐप','और गेम।']]){
    const f=fixture({title,second});f.move();f.tick();
    assert.equal(f.heading.childNodes[0],f.first);assert.equal(f.heading.childNodes[1],f.br);assert.equal(f.heading.childNodes[2],f.gradient);
    assert.equal(f.gradient.childNodes[0],f.secondText);assert.equal(f.first.data,title);assert.equal(f.secondText.data,second);
    assert.equal(f.echoes().length,2);
    assert.equal(f.gradient.getAttribute('id'),'localized-gradient');
    for(const layer of f.echoes()){
      assert.equal(layer.textContent,title+second);assert.equal(layer.getAttribute('aria-hidden'),'true');assert.ok(layer.hasAttribute('inert'));assert.ok(layer.hasAttribute('data-no-l10n'));
      assert.equal(layer.childNodes.length,3);assert.notEqual(layer.childNodes[0],f.first);assert.equal(layer.childNodes[0].textContent,title);
      assert.equal(layer.childNodes[1].tagName,'BR');assert.notEqual(layer.childNodes[1],f.br);
      assert.equal(layer.childNodes[2].className,'gradient-word');assert.notEqual(layer.childNodes[2],f.gradient);assert.equal(layer.childNodes[2].textContent,second);
      assert.equal(layer.querySelectorAll('[id]').length,0,'generated paint must not duplicate source element IDs');
    }
  }
});

test('pointer updates coalesce and settle without an idle RAF or repeated layout measurements',()=>{
  const f=fixture();assert.equal(f.frames.size,0);assert.equal(f.heading.reads,0);
  for(let i=0;i<100;i++)f.move(f.heading,'mouse',200+i,160);
  assert.equal(f.frames.size,1);assert.equal(f.heading.reads,1);assert.equal(f.styleReads(),1);f.tick();assert.equal(f.frames.size,0);
  assert.equal(f.heading.style['--studio-x'],'279.00px');
  for(const fn of f.timers.values())fn();f.timers.clear();assert.equal(f.frames.size,0);assert.ok(!f.heading.hasAttribute('data-studio-surge'));
  f.heading.emit('pointerleave');f.move();f.tick();assert.equal(f.heading.reads,1);assert.equal(f.echoes().length,2);
});

test('text and language changes release obsolete echoes and rebuild only on the next hover',()=>{
  const f=fixture();f.move();f.tick();f.first.data='Новый заголовок';f.mutate();
  assert.equal(f.frames.size,0);assert.equal(f.echoes().length,0);assert.equal(f.heading.reads,1);
  f.move();f.tick();assert.equal(f.heading.reads,2);assert.ok(f.echoes()[0].textContent.startsWith('Новый заголовок'));
  f.window.emit('hanzi:languagechange');assert.equal(f.echoes().length,0);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});

test('touch, coarse pointers and reduced motion retain readable native text without effects',()=>{
  for(const options of [{fine:false},{reduced:true}]){const f=fixture(options);f.move();assert.equal(f.frames.size,0);assert.equal(f.echoes().length,0);}
  const f=fixture();f.move(f.heading,'touch');assert.equal(f.frames.size,0);f.move();f.tick();f.motionMedia.matches=true;f.motionMedia.emit('change');
  assert.equal(f.frames.size,0);assert.equal(f.echoes().length,0);assert.ok(!f.heading.hasAttribute('data-studio-active'));
  f.motionMedia.matches=false;f.root.dataset.motion='reduced';f.move();assert.equal(f.frames.size,0);
});

test('selection, scrolling, hidden and offscreen pages cancel active paint and queued work',()=>{
  for(const stop of [f=>f.select(true),f=>f.document.emit('scroll'),f=>{f.document.hidden=true;f.document.emit('visibilitychange');},f=>f.offscreen(),f=>f.window.emit('pagehide')]){
    const f=fixture();f.move();assert.equal(f.frames.size,1);stop(f);
    assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.ok(!f.heading.hasAttribute('data-studio-active'));
  }
  const f=fixture();f.move();f.tick();f.document.emit('scroll');f.move();f.tick();assert.equal(f.heading.reads,2,'scroll invalidates cached viewport position');
});

test('multiple initialization does not duplicate layers and secondary text keeps its source',()=>{
  const f=fixture();f.runAgain();f.move();f.tick();assert.equal(f.echoes().length,2);assert.equal(f.timers.size,1);
  const original=f.intro.childNodes[0];f.move(f.intro);f.tick();assert.equal(f.intro.childNodes[0],original);assert.equal(f.intro.textContent,'Readable original description');
  assert.equal(f.intro.dataset.studioText,'ink');f.move(f.signal);f.tick();assert.equal(f.signal.textContent,'Explore the projects');assert.equal(f.signal.dataset.studioText,'signal');
});
