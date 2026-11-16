import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const handler=home.slice(home.indexOf('let raf=0;window.addEventListener(\'pointermove\''),home.indexOf('const observer=new IntersectionObserver'));

function fixture(theme){
  const pending=new Map(),writes=[],root={dataset:{},style:{setProperty:(...args)=>writes.push(args)}};
  if(theme)root.dataset.siteTheme=theme;
  let pointer,serial=0;
  const window={addEventListener(name,fn,options){assert.equal(name,'pointermove');assert.equal(options.passive,true);pointer=fn;}};
  vm.runInNewContext(handler,{root,window,requestAnimationFrame:fn=>{pending.set(++serial,fn);return serial;}});
  assert.equal(typeof pointer,'function','the real portfolio pointer handler must be installed');
  return {root,writes,pending,move:(x,y)=>pointer({clientX:x,clientY:y}),flush(){const jobs=[...pending.values()];pending.clear();for(const job of jobs)job();}};
}

test('the active page palette receives no unused whole-document pointer style updates',()=>{
  const f=fixture('portfolio');
  for(let i=0;i<120;i++)f.move(i,i*2);
  assert.equal(f.pending.size,0);
  assert.deepEqual(f.writes,[]);
});

test('the unthemed fallback retains its pointer glow and one frame per input burst',()=>{
  const f=fixture();
  f.move(120,240);for(let i=0;i<120;i++)f.move(i,i*2);
  assert.equal(f.pending.size,1);assert.deepEqual(f.writes,[]);
  f.flush();
  assert.deepEqual(f.writes,[['--mx','120px'],['--my','240px']]);
  f.move(60,80);assert.equal(f.pending.size,1);f.flush();
  assert.deepEqual(f.writes.slice(-2),[['--mx','60px'],['--my','80px']]);
});

test('a palette activated before the pending frame avoids stale writes and releases the scheduler',()=>{
  const f=fixture();f.move(120,240);f.root.dataset.siteTheme='portfolio';f.flush();
  assert.deepEqual(f.writes,[]);assert.equal(f.pending.size,0);
  delete f.root.dataset.siteTheme;f.move(20,30);assert.equal(f.pending.size,1);f.flush();
  assert.deepEqual(f.writes,[['--mx','20px'],['--my','30px']]);
});
