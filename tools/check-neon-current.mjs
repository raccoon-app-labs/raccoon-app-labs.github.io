import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../assets/neon-current-demo.js',import.meta.url),'utf8');
function game({illustrated=false,reduced=true}={}){
  const calls=[];
  const ctx=new Proxy({}, {get:(_,key)=>key==='canvas'?{}:(...args)=>calls.push({key,args})}),elements=new Map();
  const element=()=>({dataset:{},textContent:'',addEventListener(){},setPointerCapture(){},setAttribute(){},getAttribute(){return null;},getContext:()=>ctx});
  const root=element();root.querySelector=s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);};
  const art=illustrated?JSON.parse(fs.readFileSync(new URL('../assets/demo/neon-comic/art.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').split('window.NeonDemoArt=')[1].split(';\n')[0]):{};
  const sandbox={calls,document:{documentElement:{lang:'en'},querySelector:()=>root,addEventListener(){},hidden:false},Image:class{naturalWidth=illustrated?160:0;naturalHeight=160},window:{NeonDemoArt:art,matchMedia:()=>({matches:reduced}),addEventListener(){}},IntersectionObserver:class{observe(){}},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},Math};
  const instrumented=source.replace(/\}\)\(\);\s*$/,`globalThis.testGame={press,release,physics,reset,draw,tick,togglePause,calls,snapshot:()=>({x,y,vx,vy,attached,redirects,boost,height,dead,complete,coins:coinCount,puppetFlight,phase,landingAge,paused}),set:(s)=>{if(s.x!==undefined)x=s.x;if(s.y!==undefined)y=s.y;if(s.vx!==undefined)vx=s.vx;if(s.vy!==undefined)vy=s.vy;}};})();`);
  vm.runInNewContext(instrumented,sandbox);return sandbox.testGame;
}
const cold=game();assert(cold.calls.filter(c=>c.key==='fill').length>=6,'Walls and a visible comet must render before any image loads');
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
const idle=game({reduced:false}),before=idle.snapshot();idle.tick(1000);assert(idle.snapshot().phase>before.phase);assert.equal(idle.snapshot().x,before.x);assert.equal(idle.snapshot().y,before.y,'Idle decoration must not run player physics');
const painted=game({illustrated:true,reduced:false}),plain=game();painted.press();plain.press();
assert(painted.snapshot().puppetFlight,'The six-part native puppet is selected at takeoff');
for(let i=0;i<10;i++){painted.physics();plain.physics();}
painted.calls.length=0;painted.draw();const firstAngles=painted.calls.filter(c=>c.key==='rotate').map(c=>c.args[0]);
assert(painted.calls.filter(c=>c.key==='drawImage').length>=6,'The actual painted limbs and body must be drawn');
for(let i=0;i<8;i++){painted.physics();plain.physics();}
painted.calls.length=0;painted.draw();const nextAngles=painted.calls.filter(c=>c.key==='rotate').map(c=>c.args[0]);assert.notDeepEqual(firstAngles,nextAngles,'The puppet articulation follows the rising/apex motion');
for(const key of ['x','y','vx','vy'])assert.equal(painted.snapshot()[key],plain.snapshot()[key],'Visual articulation must not alter physics');
const trap=game();trap.press();trap.release();trap.set({x:810,y:1340,vx:0,vy:0});trap.physics();assert(trap.snapshot().dead,'The authored red mines must collide with the player');trap.reset();assert(!trap.snapshot().dead);
const collector=game();collector.press();collector.release();collector.set({x:672,y:575,vx:0,vy:0});collector.physics();assert.equal(collector.snapshot().coins,1,'The original coin can be collected');
const pause=game();pause.press();pause.physics();const freeze=pause.snapshot();pause.togglePause();pause.tick(1000);pause.physics();assert(pause.snapshot().paused);assert.equal(pause.snapshot().x,freeze.x);assert.equal(pause.snapshot().y,freeze.y,'Pause must freeze physics');pause.togglePause();pause.physics();assert(!pause.snapshot().paused);assert.notEqual(pause.snapshot().x,freeze.x,'Resume continues the same run');pause.togglePause();pause.reset();assert(!pause.snapshot().paused,'Reset restores the ready state');
console.log(JSON.stringify({checks:17,errors:[],source:'Active Player.tscn chain + current opening patterns'}));
