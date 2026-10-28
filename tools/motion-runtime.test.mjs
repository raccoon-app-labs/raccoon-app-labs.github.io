import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../assets/appearance/motion.js',import.meta.url),'utf8');
function fixture(){
  const listeners=()=>{const handlers=new Map();return {addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);},emit(name){for(const fn of handlers.get(name)||[])fn();}};};
  const root={dataset:{}},hosts=[{dataset:{}},{dataset:{}}],timers=new Map();let serial=0,notifications=0,intersect;
  const document={...listeners(),documentElement:root,hidden:false,querySelectorAll:()=>hosts};
  const window={...listeners(),dispatchEvent(event){assert.equal(event.type,'raccoon:scrollstate');notifications++;}};
  class IntersectionObserver{constructor(fn){intersect=fn;}observe(){}}
  class Event{constructor(type){this.type=type;}}
  const context={document,window,IntersectionObserver,Event,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  return {root,document,window,hosts,timers,context,notifications:()=>notifications,intersect:entries=>intersect(entries),flush(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());}};
}
test('a scroll burst sends one pause and one resume instead of work for every wheel event',()=>{
  const f=fixture();for(let i=0;i<120;i++)f.document.emit('scroll');
  assert.equal(f.root.dataset.siteScrolling,'true');assert.equal(f.notifications(),1);assert.equal(f.timers.size,1);
  f.flush();assert.equal(f.root.dataset.siteScrolling,undefined);assert.equal(f.notifications(),2);
});
test('scrollend, hidden documents and page navigation release decorative work safely',()=>{
  const f=fixture();f.document.emit('scroll');f.document.emit('scrollend');assert.equal(f.timers.size,0);assert.equal(f.notifications(),2);
  f.document.emit('scroll');f.document.hidden=true;f.document.emit('visibilitychange');assert.equal(f.root.dataset.siteScrolling,undefined);
  f.document.emit('scroll');assert.equal(f.root.dataset.siteScrolling,undefined);
  f.document.hidden=false;f.document.emit('scroll');f.window.emit('pagehide');assert.equal(f.timers.size,0);
  f.document.emit('scroll');assert.equal(f.root.dataset.siteScrolling,undefined);
  f.window.emit('pageshow');f.document.emit('scroll');assert.equal(f.root.dataset.siteScrolling,'true');
});
test('only offscreen decorative hosts are marked for paused CSS animation',()=>{
  const f=fixture();f.intersect([{target:f.hosts[0],isIntersecting:false},{target:f.hosts[1],isIntersecting:true}]);
  assert.equal(f.hosts[0].dataset.motionVisibility,'offscreen');assert.equal(f.hosts[1].dataset.motionVisibility,'visible');
  f.intersect([{target:f.hosts[0],isIntersecting:true}]);assert.equal(f.hosts[0].dataset.motionVisibility,'visible');
});
test('installing the shared controller twice does not duplicate event listeners',()=>{
  const f=fixture();vm.runInNewContext(source,f.context);f.document.emit('scroll');assert.equal(f.notifications(),1);assert.equal(f.timers.size,1);
});
