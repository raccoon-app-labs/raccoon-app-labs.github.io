import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const diode=readFileSync(new URL('../plus/diode-field.js',import.meta.url),'utf8');
const start=diode.indexOf('  function paintSurge()');
const wave=diode.slice(start,diode.indexOf('  function update(dt)',start));

function expectedWave(surge,cols,rows){
  const lamps=[],t=surge.age/surge.duration,envelope=Math.min(1,t*9,(1-t)*9);
  const reach=surge.kind==='diagonal'?cols-1+(rows-1)*.7:Math.hypot(Math.max(surge.col,cols-surge.col),Math.max(surge.row,rows-surge.row));
  const front=-2+(reach+14)*t;
  // Original full-matrix traversal: this is the visual contract of the effect.
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const position=surge.kind==='diagonal'?(surge.reverse?cols-1-col:col)+row*.7:Math.hypot(col-surge.col,row-surge.row);
    const behind=front-position;if(behind<0||behind>11)continue;
    const echo=behind>5;
    const power=envelope*(echo?.65*Math.exp(-(behind-5)*.36):1.15*Math.exp(-behind*.27));
    lamps.push([col,row,power,echo?(surge.color+1)%3:surge.color]);
  }
  return lamps;
}

function actualWave(surge,cols,rows){
  const lamps=[],stats={radialReads:0,hypot:0};
  const distances=Array.from({length:cols*rows},(_,i)=>Math.hypot(i%cols-surge.col,Math.floor(i/cols)-surge.row));
  const radialDistances=new Proxy(distances,{get(target,key){if(/^\d+$/.test(String(key)))stats.radialReads++;return target[key];}});
  const math=Object.create(Math);math.hypot=(...args)=>{stats.hypot++;return Math.hypot(...args);};
  vm.runInNewContext(wave+'\npaintSurge();',{surge,cols,rows,radialDistances,Math:math,paintLamp:(...args)=>lamps.push(args)});
  return {lamps,stats};
}

test('bounded diode waves preserve every original lamp, exact power, colour and overlap order',()=>{
  for(const [cols,rows] of [[2,2],[19,57],[93,68],[194,93]])for(const kind of ['diagonal','radial'])for(const reverse of [false,true]){
    for(const fraction of [0,.001,.04,.12,.25,.45,.6,.8,.95,.999,1]){
      const surge={kind,reverse,col:cols*.52,row:rows*.4,duration:kind==='radial'?4.3:3.8,age:0,color:1};
      surge.age=surge.duration*fraction;
      assert.deepEqual(actualWave(surge,cols,rows).lamps,expectedWave(surge,cols,rows),`${cols}x${rows} ${kind} ${reverse} ${fraction}`);
    }
  }
});

test('a radial crest checks only its narrow band and reuses cached distances',()=>{
  const cols=194,rows=93,surge={kind:'radial',col:cols*.52,row:rows*.4,duration:4.3,age:4.3*.6,color:0};
  const {lamps,stats}=actualWave(surge,cols,rows);
  assert.ok(lamps.length>0);
  assert.equal(stats.hypot,1,'only the frame reach needs hypot, not every diode');
  assert.ok(stats.radialReads<cols*rows*.3,`${stats.radialReads} visited diodes should be far below the ${cols*rows} grid cells`);
});

const ink=readFileSync(new URL('../plus/neon-ink.js',import.meta.url),'utf8');
function inkFixture(){
  const frames=new Map(),observers=[],events=new Map(),order=[];let serial=0,rectReads=0;
  const listen=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
  class Element{
    constructor(tag){this.tag=tag;this.nodeType=1;this.dataset={};this.children=[];this.isConnected=true;this.style={setProperty(){order.push('write');}};}
    append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}}
    contains(node){return node===this||this.children.some(child=>child.contains?.(node)||child===node);}
    closest(){return this.tag==='neon-ink'?this:this.parentElement?.closest()||null;}
    setAttribute(){} removeAttribute(){}
    getClientRects(){rectReads++;order.push('rect');return [{left:10,right:160,top:10,bottom:34,width:150,height:24}];}
    addEventListener(name,fn){listen(name,fn);}
  }
  const root=new Element('html'),body=new Element('body'),panel=new Element('main');root.dataset.app='neon';root.append(body);body.append(panel);
  function textHost(copy){
    const host=new Element('p');panel.append(host);
    const text={nodeType:3,data:copy,parentElement:host,replaceWith(node){const parent=this.parentElement;parent.children=parent.children.map(child=>child===this?node:child);node.parentElement=parent;}};
    host.children.push(text);return host;
  }
  textHost('First line');textHost('Second line');
  const document={documentElement:root,body,hidden:false,getElementById:()=>panel,querySelector:()=>null,addEventListener:listen,createElement:tag=>new Element(tag),
    createTreeWalker(area){const texts=[];function collect(node){for(const child of node.children||[]){if(child.nodeType===3)texts.push(child);else collect(child);}}collect(area);let index=0;return {nextNode(){this.currentNode=texts[index++];return !!this.currentNode;}};}};
  const context={document,window:{addEventListener:listen},Node:{ELEMENT_NODE:1,TEXT_NODE:3},NodeFilter:{SHOW_TEXT:4},innerHeight:740,innerWidth:1280,getSelection:()=>({isCollapsed:true}),
    matchMedia:query=>({matches:query.includes('pointer: fine'),addEventListener(){}}),
    getComputedStyle:()=>{order.push('computed');return {fontSize:'20px',color:'#fff'};},
    MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}},ResizeObserver:class{observe(){}},
    addEventListener:listen,requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(ink,context);
  return {frames,order,panel,textHost,rectReads:()=>rectReads,
    mutate(node){observers[0].fn([{type:'childList',target:panel,addedNodes:[node],removedNodes:[]}]);},
    move(){for(const fn of events.get('pointermove')||[])fn({isPrimary:true,pointerType:'mouse',clientX:35,clientY:20});},
    tick(){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(100);}};
}

test('text updates without a pointer do not measure the complete Neon text layout',()=>{
  const f=inkFixture();f.mutate(f.textHost('Dynamically inserted translated text'));f.tick();
  assert.equal(f.rectReads(),0);assert.equal(f.frames.size,0,'no idle loop after the update');
  f.move();f.tick();assert.equal(f.rectReads(),3,'the first actual pointer frame measures each text run once');
});

test('electric ink resolves all activation styles before making paint writes',()=>{
  const f=inkFixture();f.move();f.tick();
  assert.equal(f.order.filter(item=>item==='computed').length,2);
  assert.ok(f.order.lastIndexOf('computed')<f.order.indexOf('write'),'activations must not interleave computed-style reads and writes');
});
