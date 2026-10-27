import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/lazy-scripts.js',import.meta.url),'utf8');
const flush=()=>new Promise(setImmediate);
function scene(){
 const requests=[],buttons=[],target={dataset:{},querySelector:()=>({append:b=>buttons.push(b)})};let intersect;
 const placeholders=['mechanics.js','game.js','art.js'].map(src=>({dataset:{lazySrc:src,lazyTarget:'#try'},getAttribute:()=>null,after:script=>requests.push(script)}));
 const document={documentElement:{lang:'ru'},querySelectorAll:()=>placeholders,querySelector:()=>target,createElement:()=>({dataset:{},setAttribute(){},remove(){},addEventListener(name,fn){this[name]=fn;}})};
 class IntersectionObserver{constructor(callback){intersect=callback;}observe(){}unobserve(){}}
 vm.runInNewContext(source,{document,IntersectionObserver});return {requests,buttons,target,near:()=>intersect([{target,isIntersecting:true}])};
}
test('demo transfers start near the section and dependencies execute in order',async()=>{
 const {requests,target,near}=scene();assert.equal(requests.length,0);near();assert.equal(requests[0].src,'mechanics.js');
 requests[0].onload();await flush();assert.equal(requests[1].src,'game.js');requests[1].onload();await flush();assert.equal(requests[2].src,'art.js');
 requests[2].onload();await flush();assert.equal(target.dataset.demoState,'ready');
});
test('retrying a failed demo does not execute already initialized dependencies again',async()=>{
 const {requests,buttons,target,near}=scene();near();requests[0].onload();await flush();requests[1].onerror();await flush();
 assert.equal(target.dataset.demoState,'error');buttons[0].click();assert.equal(requests[2].src,'game.js');requests[2].onload();await flush();requests[3].onload();await flush();
 assert.equal(target.dataset.demoState,'ready');assert.equal(requests.filter(s=>s.src==='mechanics.js').length,1);
});
