import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../assets/neon-current-demo.js',import.meta.url),'utf8');
function game(){
  const ctx=new Proxy({}, {get:(_,key)=>key==='canvas'?{}:()=>{}}),elements=new Map();
  const element=()=>({dataset:{},textContent:'',addEventListener(){},setPointerCapture(){},getContext:()=>ctx});
  const root=element();root.querySelector=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);};
  const sandbox={document:{documentElement:{lang:'en'},querySelector:()=>root,addEventListener(){},hidden:false},Image:class{naturalWidth=0;naturalHeight=1},window:{matchMedia:()=>({matches:true}),addEventListener(){}},IntersectionObserver:class{observe(){}},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},Math};
  const instrumented=source.replace(/reset\(\);\s*\}\)\(\);\s*$/,`reset(); globalThis.testGame={press,release,physics,reset,snapshot:()=>({x,y,vx,vy,attached,redirects,boost,height,dead,complete,coins:coinCount}),set:(s)=>{if(s.x!==undefined)x=s.x;if(s.y!==undefined)y=s.y;if(s.vx!==undefined)vx=s.vx;if(s.vy!==undefined)vy=s.vy;}};})();`);
  vm.runInNewContext(instrumented,sandbox);return sandbox.testGame;
}
const tap=game(),hold=game();tap.press();tap.release();hold.press();
for(let i=0;i<18;i++){tap.physics();hold.physics();}
assert(Math.abs(Math.abs(hold.snapshot().vx)-Math.abs(tap.snapshot().vx)-315)<1);
assert(hold.snapshot().vy<tap.snapshot().vy-600,'Hold includes both short boost and base air thrust');
hold.press();assert(hold.snapshot().vx>0,'A second tap turns back toward the launch wall');assert.equal(hold.snapshot().redirects,0);
hold.release();for(let i=0;i<60;i++)hold.physics();assert(hold.snapshot().attached,'Redirect can reattach to the wall');
const runner=game();runner.press();for(let i=0;i<50;i++){runner.physics();if(runner.snapshot().attached)break;}
assert(runner.snapshot().attached,'Held jump reaches the opposite native starting wall');assert(runner.snapshot().x<400);
const falling=game();falling.press();falling.release();falling.set({x:50,y:2000,vx:0,vy:100});falling.physics();assert(falling.snapshot().dead,'Falling below the camera ends the run');
falling.reset();assert(!falling.snapshot().dead);assert.equal(falling.snapshot().attached,'wall');
console.log(JSON.stringify({checks:7,errors:[],source:'Active Player.tscn chain + current opening patterns'}));
