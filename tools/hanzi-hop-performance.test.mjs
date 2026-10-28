import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../plus/hanzi-hop.js',import.meta.url),'utf8');
function fixture(){
  const handlers=new Map(),frames=new Map(),timers=new Map(),elements=[];let serial=0,rangeReads=0,now=1000;
  const listen=(name,fn)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);};
  const style=()=>({setProperty(k,v){this[k]=v;},getPropertyValue(k){return this[k]||'';},getPropertyPriority(){return '';},removeProperty(k){delete this[k];}});
  const rect={left:10,top:10,right:90,bottom:40,width:80,height:30};
  class Element{
    constructor(tag){this.tag=tag;this.nodeType=1;this.dataset={};this.style=style();this.children=[];this.attrs=new Map();this.isConnected=true;elements.push(this);}
    append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.isConnected=false;}
    closest(){return ['hanzi-hop','hanzi-hop-layer','hanzi-hop-letter'].includes(this.tag)?this:null;}
    contains(node){return node===this || this.children.some(child=>child.contains?.(node));}
    setAttribute(k,v){this.attrs.set(k,v);}
    removeAttribute(k){this.attrs.delete(k);}
    getClientRects(){return [rect];}
    getBoundingClientRect(){return rect;}
    addEventListener(name,fn){listen(name,fn);}
    animate(){return {finished:Promise.resolve(),cancel(){}};}
  }
  const root=new Element('html');root.dataset.app='keys';
  const body=new Element('body'),content=new Element('main'),host=new Element('h1');root.append(body);body.append(content);content.append(host);
  const text={data:'Hello',parentElement:host,nodeType:3,replaceWith(node){host.children=host.children.map(n=>n===this?node:n);node.parentElement=host;}};host.children.push(text);
  const document={documentElement:root,body,hidden:false,getElementById:()=>content,querySelector:()=>null,addEventListener:listen,
    createTreeWalker(){let used=false;return {nextNode(){if(used)return false;used=true;this.currentNode=text;return true;}};},
    createElement:tag=>new Element(tag),createRange(){let index=0;return {setStart(node,i){index=i;},setEnd(){},getClientRects(){rangeReads++;return [{...rect,left:10+index*12,right:22+index*12,width:12}];},getBoundingClientRect(){rangeReads++;return {...rect,left:10+index*12,width:12};},detach(){}};}};
  const computed={fontSize:'20px',color:'#fff',transform:'none',rotate:'none',translate:'none',scale:'none'};
  const context={document,window:{addEventListener:listen},MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},Node:{ELEMENT_NODE:1,TEXT_NODE:3},NodeFilter:{SHOW_TEXT:4},getComputedStyle:()=>computed,innerHeight:720,Intl,
    matchMedia:query=>({matches:query.includes('pointer: fine'),addEventListener(){}}),addEventListener:listen,
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  const emit=(name,event={})=>{for(const fn of handlers.get(name)||[])fn(event);};
  const pump=()=>{for(let i=0;i<300 && frames.size;i++){now+=16.667;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}};
  const move=()=>emit('pointermove',{target:host,isPrimary:true,pointerType:'mouse',clientX:25,clientY:25});
  return {emit,pump,move,frames,rangeReads:()=>rangeReads,layers:()=>elements.filter(x=>x.tag==='hanzi-hop-layer'&&x.isConnected),settleScroll(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());}};
}
test('letter geometry is reused for repeat hover and after scrolling',()=>{
  const f=fixture();f.move();f.pump();const reads=f.rangeReads();assert.ok(reads>0);assert.equal(f.frames.size,0);
  f.emit('pointerleave');f.move();f.pump();assert.equal(f.rangeReads(),reads,'repeat hover reuses glyph ranges');
  f.emit('scroll');f.move();assert.equal(f.frames.size,0,'hover must yield during scrolling');
  f.settleScroll();f.move();f.pump();assert.equal(f.rangeReads(),reads,'scroll changes the origin, not the local glyph layout');
  assert.equal(f.layers().length,1);
});
test('resize invalidates cached glyph layout once and releases detached layers',()=>{
  const f=fixture();f.move();f.pump();const reads=f.rangeReads();f.emit('resize');assert.equal(f.layers().length,0);
  f.move();f.pump();assert.ok(f.rangeReads()>reads);assert.equal(f.layers().length,1);assert.equal(f.frames.size,0);
});
