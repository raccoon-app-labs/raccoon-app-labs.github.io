import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(process.env.STUDIO_MOTION_SOURCE||new URL('../assets/studio-motion.js',import.meta.url),'utf8');
const css=readFileSync(process.env.STUDIO_MOTION_CSS||new URL('../assets/studio-motion.css',import.meta.url),'utf8');

function fixture({width=1280,height=844,reduced=false,fine=true,motion,world='studio'}={}){
  const frames=new Map(),timers=new Map(),created=[],listeners=[],observers=[],transforms=[],styleWrites=[];let serial=0,layoutReads=0;
  function events(target={}){
    const handlers=new Map();
    return Object.assign(target,{
      addEventListener(name,callback,options){listeners.push({target,name,options});if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(callback);},
      emit(name,data={}){const event={preventDefault(){assert.fail('decorative input must preserve native interaction');},...data};for(const callback of handlers.get(name)||[])callback(event);}
    });
  }
  class Element{
    constructor(tag){
      events(this);this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs=new Map();this.dataset={};this.tokens=new Set();
      this.style={setProperty:(name,value)=>{this.style[name]=value;styleWrites.push({node:this,name,value});},removeProperty:name=>{delete this.style[name];}};
      Object.defineProperty(this.style,'transform',{get:()=>this.transformValue||'',set:value=>{this.transformValue=value;transforms.push({node:this,value});}});
      this.classList={add:(...names)=>names.forEach(name=>this.tokens.add(name)),remove:(...names)=>names.forEach(name=>this.tokens.delete(name)),contains:name=>this.tokens.has(name),toggle:(name,on)=>{const enabled=on??!this.tokens.has(name);if(enabled)this.tokens.add(name);else this.tokens.delete(name);return enabled;}};
    }
    get className(){return [...this.tokens].join(' ');}set className(value){this.tokens=new Set(value.split(/\s+/).filter(Boolean));}
    get firstChild(){return this.children[0]||null;}
    append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(child=>child!==node);node.parentElement=this;this.children.push(node);}}
    prepend(...nodes){for(const node of [...nodes].reverse()){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(child=>child!==node);node.parentElement=this;this.children.unshift(node);}}
    setAttribute(name,value=''){this.attrs.set(name,String(value));}
    getAttribute(name){return this.attrs.get(name)??null;}
    removeAttribute(name){this.attrs.delete(name);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    querySelectorAll(selector){return descendants(this).filter(node=>selector.startsWith('.')?node.classList.contains(selector.slice(1)):node.tagName===selector.toUpperCase());}
    getBoundingClientRect(){layoutReads++;throw new Error('background movement must not read layout');}
    get offsetWidth(){layoutReads++;return 400;}
  }
  function descendants(node){return node.children.flatMap(child=>[child,...descendants(child)]);}
  const root=new Element('html');root.dataset={siteWorld:world,theme:'dark',...(motion?{motion}:{})};root.lang='ru';
  const body=new Element('body'),visual=new Element('div'),core=new Element('div'),logo=new Element('img');visual.className='visual';core.className='core';logo.className='core-logo';core.append(logo);visual.append(core);visual.setAttribute('aria-hidden','true');
  const labels={stories:'Magical Stories',keys:'Hanzi Keys',bloom:'Hanzi Bloom',muropolis:'Muropolis',neon:'Neon Cyber Wall Kicker',food:'What Shall We Eat?',dokupit:'Dokupit'};
  const sections=[new Element('section'),new Element('section'),new Element('nav')];
  const document=events({documentElement:root,body,hidden:false,
    createElement(tag){const node=new Element(tag);created.push(node);return node;},
    querySelector(selector){if(selector==='.visual')return visual;const name=selector.match(/^\.app-card\.([a-z]+) h3$/)?.[1];return name?{textContent:labels[name]}:body.querySelector(selector);},
    querySelectorAll(selector){return selector==='.showcase,.values,.project-pages'?sections:body.querySelectorAll(selector);}
  });
  const global=events(),reducedMedia=events({matches:reduced}),fineMedia=events({matches:fine});
  class Observer{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(target,options){this.targets.push({target,options});}disconnect(){}}
  const context={document,window:global,Math,MutationObserver:Observer,IntersectionObserver:Observer,matchMedia:query=>query.includes('prefers-reduced-motion')?reducedMedia:fineMedia,innerWidth:width,innerHeight:height,
    addEventListener:global.addEventListener,requestAnimationFrame:callback=>{frames.set(++serial,callback);return serial;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:callback=>{timers.set(++serial,callback);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  const host=()=>body.querySelector('.studio-atmosphere'),depth=()=>body.querySelector('.studio-atmosphere-depth');
  return {root,body,visual,core,logo,sections,document,context,created,listeners,frames,timers,observers,transforms,styleWrites,reducedMedia,fineMedia,host,depth,
    layoutReads:()=>layoutReads,emit:global.emit,
    move(x=1200,y=760,type='mouse'){document.emit('pointermove',{clientX:x,clientY:y,pointerType:type});},
    mutate(name){for(const observer of observers)for(const {target,options}of observer.targets)if(target===root&&options?.attributeFilter?.includes(name))observer.callback([{attributeName:name}]);},
    tick(now){assert.equal(frames.size,1,'the pointer controller owns a single frame');const [callback]=frames.values();frames.clear();callback(now);},
    settle(){let ticks=0;for(;frames.size&&ticks<300;ticks++)this.tick(16.667*(ticks+1));assert.equal(frames.size,0,'pointer easing must finish');return ticks;},
    runAgain(){vm.runInNewContext(source,context);}
  };
}

function translation(node){
  const numbers=node.style.transform.match(/translate3d\(\s*([\d.e+-]+)px,\s*([\d.e+-]+)px,\s*(?:0|0px)\s*\)/);
  assert.ok(numbers,'the depth layer has a composited pixel translation');return [+numbers[1],+numbers[2]];
}

const stars=f=>f.body.querySelectorAll('.studio-star');
const near=star=>Number(star.style['--star-near']||0);
function starPosition(f,star){return [parseFloat(star.style.left)/100*f.context.innerWidth,parseFloat(star.style.top)/100*f.context.innerHeight];}

test('the original sparse stars are restored above the three gradients with deterministic finite positions',()=>{
  const f=fixture(),field=f.host().querySelector('.studio-stars'),points=stars(f);assert.ok(field);assert.equal(points.length,88);
  assert.equal(field.parentElement,f.host());assert.notEqual(field.parentElement,f.depth(),'stars stay outside gradient parallax so input uses viewport positions');
  assert.equal(f.depth().querySelectorAll('.studio-gradient').length,3);assert.equal(f.frames.size,0);
  const positions=points.map(star=>[parseFloat(star.style.left),parseFloat(star.style.top)]);
  assert.equal(new Set(positions.map(value=>value.join(','))).size,88,'the star positions are distinct');
  for(const [x,y]of positions){assert.ok(Number.isFinite(x)&&x>=0&&x<100);assert.ok(Number.isFinite(y)&&y>=0&&y<100);}
  for(const star of points){assert.equal(star.tagName,'SPAN');const size=parseFloat(star.style.width);assert.ok(Number.isFinite(size)&&size>0&&size<=3);assert.equal(star.style.width,star.style.height);}
  const again=fixture();assert.deepEqual(stars(again).map(star=>[star.style.left,star.style.top]),points.map(star=>[star.style.left,star.style.top]));
  assert.equal(f.host().querySelectorAll('canvas').length,0);assert.equal(f.host().querySelectorAll('img').length,0);
});

test('nearby stars grow through a coalesced input frame while distant stars stay quiet',()=>{
  const f=fixture(),points=stars(f),target=points[17],[px,py]=starPosition(f,target);
  f.styleWrites.length=0;f.move(px,py);f.move(px,py);f.move(px,py);assert.equal(f.frames.size,1);f.tick(16.667);
  assert.ok(near(target)>.95,'the star directly beneath the pointer receives the largest highlight');
  const far=points.find(star=>{const [x,y]=starPosition(f,star);return Math.hypot(x-px,y-py)>300;});assert.ok(far);assert.equal(near(far),0,'distant stars retain their base size');
  assert.ok(f.styleWrites.filter(write=>write.name==='--star-near').length<88,'only affected stars need style updates');
  f.settle();assert.equal(f.frames.size,0,'star growth does not create a permanent render loop');
  f.styleWrites.length=0;f.move(px,py);if(f.frames.size)f.settle();assert.equal(f.styleWrites.filter(write=>write.name==='--star-near').length,0,'unchanged proximity does not rewrite star styles');
  f.root.emit('pointerleave');if(f.frames.size)f.settle();assert.ok(points.every(star=>near(star)===0),'leaving restores every highlighted star');assert.equal(f.layoutReads(),0);
});

test('star input is still processed at the centered gradient position and after parallax has settled',()=>{
  const f=fixture();f.move(f.context.innerWidth/2,f.context.innerHeight/2);assert.equal(f.frames.size,1,'star changes are scheduled even if gradient offset stays zero');
  f.tick(16.667);assert.ok(stars(f).some(star=>near(star)>0));assert.equal(f.frames.size,0,'the centered input needs only its star update');
  f.root.emit('pointerleave');if(f.frames.size)f.settle();assert.ok(stars(f).every(star=>near(star)===0));
});

test('pause, resize and capability changes clear star highlights without removing stars or gradients',()=>{
  const cases=[
    f=>{f.document.hidden=true;f.document.emit('visibilitychange');},
    f=>{f.root.dataset.siteScrolling='true';f.emit('raccoon:scrollstate');},
    f=>f.emit('blur'),f=>f.emit('pagehide'),
    f=>{f.reducedMedia.matches=true;f.reducedMedia.emit('change');},
    f=>{f.root.dataset.motion='reduced';f.mutate('data-motion');},
    f=>{f.fineMedia.matches=false;f.fineMedia.emit('change');},
    f=>{f.context.innerWidth=390;f.context.innerHeight=844;f.emit('resize');}
  ];
  for(const change of cases){
    const f=fixture(),target=stars(f)[17];f.move(...starPosition(f,target));f.tick(16.667);assert.ok(near(target)>0);
    change(f);if(f.frames.size)f.settle();assert.ok(stars(f).every(star=>near(star)===0));assert.equal(stars(f).length,88);assert.equal(f.depth().querySelectorAll('.studio-gradient').length,3);assert.equal(f.frames.size,0);
  }
  for(const options of [{fine:false},{reduced:true},{motion:'reduced'}]){const f=fixture(options);f.move(...starPosition(f,stars(f)[17]));assert.equal(f.frames.size,0);assert.ok(stars(f).every(star=>near(star)===0));assert.equal(stars(f).length,88);}
  const touch=fixture();touch.move(...starPosition(touch,stars(touch)[17]),'touch');assert.equal(touch.frames.size,0);assert.ok(stars(touch).every(star=>near(star)===0));
});

test('star styling grows nearby points with a small local halo while preserving themes and reduced motion',()=>{
  const starRule=css.match(/\.studio-star\{([^}]+)\}/)?.[1];assert.ok(starRule);
  assert.match(starRule,/transform:[^;]*scale\([^;]*--star-near/,'proximity increases the visible star scale');
  assert.match(starRule,/background-color:[^;]*--star-near/,'proximity also brightens the existing point');
  assert.match(css,/\.studio-star::after\{[^}]*inset:-5px;[^}]*opacity:var\(--star-near\)/,'the halo remains local to the small star');
  assert.match(css,/\.studio-star:nth-child\(12n \+ 1\)\{animation:studio-star-twinkle/,'only sparse accents need continuous twinkling');
  assert.doesNotMatch(starRule,/\banimation:|will-change:/,'normal stars do not each force a permanent animation layer');
  assert.match(css,/:root\[data-theme=light\] \.studio-stars\{/);
  assert.match(css,/\[data-paused=true\] \.studio-star\{animation-play-state:paused\}/);
  assert.match(css,/\[data-motion=reduced\] \.studio-star\{animation:none;transition:none\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.studio-star\{animation:none;transition:none\}/);
  assert.doesNotMatch(source,/createElement\(['"]canvas['"]\)|quadraticCurveTo|\.ellipse\(/,'stars do not restore the removed canvas spirals');
});

test('the background creates three decorative CSS layers without a canvas or an idle frame',()=>{
  const f=fixture(),host=f.host(),depth=f.depth();assert.ok(host&&depth);assert.equal(host.getAttribute('aria-hidden'),'true');
  assert.equal(depth.querySelectorAll('.studio-gradient').length,3);assert.equal(host.querySelectorAll('canvas').length,0);assert.equal(host.querySelectorAll('img').length,0);
  assert.equal(f.created.filter(node=>node.tagName==='CANVAS').length,0);assert.equal(f.frames.size,0);assert.equal(f.layoutReads(),0);
  const before=f.created.length;f.runAgain();assert.equal(f.created.length,before);assert.equal(f.body.querySelectorAll('.studio-atmosphere').length,1);assert.equal(f.frames.size,0);
});

test('fine pointer movement is bounded, smooth, passive and stops once settled',()=>{
  const f=fixture();f.move(1280,844);assert.equal(f.frames.size,1);f.tick(16.667);
  const first=translation(f.depth());assert.ok(first.some(value=>Math.abs(value)>0),'movement starts toward the pointer');assert.ok(Math.abs(first[0])<12&&Math.abs(first[1])<10,'the first frame eases toward the target');
  for(let i=0;i<15;i++)f.move(1280,844);assert.equal(f.frames.size,1);f.settle();
  let [x,y]=translation(f.depth());assert.ok(Math.abs(x)<=12.01&&Math.abs(y)<=10.01);assert.ok(Math.abs(x)>10&&Math.abs(y)>8);
  f.move(-10000,10000);f.settle();[x,y]=translation(f.depth());assert.ok(Math.abs(x)<=12.01&&Math.abs(y)<=10.01,'out-of-viewport input is clamped');
  f.root.emit('pointerleave');f.settle();[x,y]=translation(f.depth());assert.ok(Math.abs(x)<.06&&Math.abs(y)<.06,'leaving the page settles at the center');assert.equal(f.layoutReads(),0);
  for(const listener of f.listeners.filter(listener=>listener.name==='pointermove'))assert.equal(listener.options?.passive,true);
});

test('touch, coarse pointers and both reduced motion preferences do not start background frames',()=>{
  for(const options of [{fine:false},{reduced:true},{motion:'reduced'}]){const f=fixture(options);f.move();assert.equal(f.frames.size,0);}
  const touch=fixture();touch.move(1100,700,'touch');assert.equal(touch.frames.size,0);
  const f=fixture();f.move();f.tick(16.667);f.reducedMedia.matches=true;f.reducedMedia.emit('change');assert.equal(f.frames.size,0);assert.equal(f.host().dataset.paused,'true');
  f.reducedMedia.matches=false;f.reducedMedia.emit('change');assert.equal(f.host().dataset.paused,'false');assert.equal(f.frames.size,0);
  f.move();f.root.dataset.motion='reduced';f.mutate('data-motion');assert.equal(f.frames.size,0);assert.equal(f.host().dataset.paused,'true');
  delete f.root.dataset.motion;f.mutate('data-motion');assert.equal(f.frames.size,0);assert.equal(f.host().dataset.paused,'false');
});

test('hidden, scrolling, blurred and closed pages pause CSS motion and cancel pending input frames',()=>{
  const f=fixture();
  const transitions=[
    [()=>{f.document.hidden=true;f.document.emit('visibilitychange');},()=>{f.document.hidden=false;f.document.emit('visibilitychange');}],
    [()=>{f.root.dataset.siteScrolling='true';f.emit('raccoon:scrollstate');},()=>{delete f.root.dataset.siteScrolling;f.emit('raccoon:scrollstate');}],
    [()=>f.emit('blur'),()=>f.emit('focus')],
    [()=>f.emit('pagehide'),()=>f.emit('pageshow')]
  ];
  for(const [pause,resume]of transitions){f.move();assert.equal(f.frames.size,1);pause();assert.equal(f.frames.size,0);assert.equal(f.host().dataset.paused,'true');f.move();assert.equal(f.frames.size,0);resume();assert.equal(f.host().dataset.paused,'false');if(f.frames.size)f.settle();assert.equal(f.frames.size,0);}
});

test('resize and pointer capability changes recenter without creating background loops',()=>{
  const f=fixture();f.move();f.tick(16.667);
  for(let i=0;i<20;i++){f.context.innerWidth=390+i;f.context.innerHeight=844;f.emit('resize');assert.equal(f.frames.size,0);const [x,y]=translation(f.depth());assert.ok(Math.abs(x)<.06&&Math.abs(y)<.06);}
  f.move(390,844);f.tick(16.667);f.fineMedia.matches=false;f.fineMedia.emit('change');if(f.frames.size)f.settle();assert.equal(f.frames.size,0);const [x,y]=translation(f.depth());assert.ok(Math.abs(x)<.06&&Math.abs(y)<.06);
});

test('the seven application links, logo pulse and localized button label are preserved',()=>{
  const f=fixture(),satellites=f.visual.querySelector('.studio-satellites'),links=satellites.querySelectorAll('a'),button=f.core.querySelector('button');
  assert.equal(links.length,7);assert.deepEqual(links.map(node=>node.href),['/apps/magical-stories/','/apps/hanzi-keys/','/apps/hanzi-bloom/','/apps/muropolis/','/apps/neon-cyber-wall-kicker/','/apps/what-to-eat/','/apps/dokupit/']);assert.ok(links.every(link=>link.getAttribute('aria-label')));
  assert.equal(button.getAttribute('aria-label'),'Зажечь созвездие приложений');assert.equal(button.children[0],f.logo);assert.equal(f.visual.getAttribute('aria-hidden'),null);
  f.root.lang='en';f.mutate('lang');assert.equal(button.getAttribute('aria-label'),'Light up the app constellation');
  button.emit('click');assert.equal(f.visual.classList.contains('is-bursting'),true);assert.equal(f.frames.size,0,'a logo click does not create background waves or frames');assert.equal(f.body.querySelectorAll('.studio-atmosphere').length,1);
});

test('non-studio pages do not create decorative background state',()=>{
  const f=fixture({world:'neon'});assert.equal(f.host(),null);assert.equal(f.frames.size,0);assert.equal(f.created.length,0);
});

test('gradient motion has bounded layers, static colour fills and CSS pauses without image or blur work',()=>{
  const atmosphere=css.slice(css.indexOf('.studio-atmosphere{'));assert.ok(atmosphere.length>0);
  assert.doesNotMatch(atmosphere,/\burl\(|\bfilter\s*:|\bbackdrop-filter\s*:|\bmix-blend-mode\s*:/,'the new background needs no downloaded texture, blur pass or blend layer');
  for(const name of ['violet','mint','rose']){
    const rule=atmosphere.match(new RegExp('\\.studio-gradient-'+name+'\\{([^}]+)\\}'))?.[1];assert.ok(rule);
    const cap=Number(rule.match(/width:min\((\d+)px,/)?.[1]);assert.ok(cap>0&&cap<=900,'gradient textures remain bounded on wide displays');assert.match(rule,/background:radial-gradient\(/);
    const motion=atmosphere.match(new RegExp('@keyframes studio-mist-'+name+'\\{from\\{([^}]+)\\}to\\{([^}]+)\\}\\}'));assert.ok(motion);
    for(const frame of motion.slice(1))assert.match(frame,/^transform:[^;{}]+;?$/,'only a composited transform changes each frame');
  }
  assert.match(atmosphere,/\[data-paused=true\] \.studio-gradient\{animation-play-state:paused\}/);
  assert.match(atmosphere,/\[data-motion=reduced\] \.studio-gradient\{animation:none\}/);
  assert.match(atmosphere,/@media\(prefers-reduced-motion:reduce\)\{\.studio-gradient\{animation:none\}\}/);
  assert.match(css,/:root\[data-site-world=studio\] body::before,:root\[data-site-world=studio\] body::after\{content:none\}/,'the old full-viewport grid and conic animation are removed');
});
