import test from 'node:test';
import assert from 'node:assert/strict';
import {createPointerMotion,advancePointer,rotationMatrix,satellitePose,projectScenePoint} from '../assets/studio-logo-model.mjs';

const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} is not close to ${expected}`);
function moveFor(seconds,dt,target,state=createPointerMotion()){
  for(let i=0;i<Math.round(seconds/dt);i++)advancePointer(state,target,dt);
  return state;
}

test('cursor response follows elapsed time rather than the number of display frames',()=>{
  const target={x:.8,y:-.5,strength:.9};
  const slow=moveFor(1,1/30,target),fast=moveFor(1,1/120,target);
  for(const key of ['x','y','vx','vy','strength'])near(slow[key],fast[key]);
  assert.ok(slow.x>.75&&slow.x<.8);
  assert.ok(slow.y<-.45&&slow.y>-.5);
});

test('extreme cursor positions and delayed frames remain bounded and finite',()=>{
  const extreme=moveFor(2,.05,{x:1000,y:-1000,strength:99});
  assert.ok(extreme.x>0&&extreme.x<=1.000001);
  assert.ok(extreme.y<0&&extreme.y>=-1.000001);
  assert.ok(extreme.strength>=0&&extreme.strength<=1);
  assert.ok(Object.values(extreme).every(Number.isFinite));
  const stalled=createPointerMotion(),bounded=createPointerMotion();
  advancePointer(stalled,{x:.7,y:.4,strength:1},20);
  advancePointer(bounded,{x:.7,y:.4,strength:1},.05);
  for(const key of Object.keys(bounded))near(stalled[key],bounded[key]);
  const unchanged={...stalled};
  for(const dt of [0,-1,NaN,Infinity])advancePointer(stalled,{x:-1,y:-1,strength:0},dt);
  assert.deepEqual(stalled,unchanged,'an invalid elapsed interval must not inject motion');
});

test('leaving the scene settles both the gaze and its momentum back to neutral',()=>{
  const state=moveFor(.5,1/60,{x:.9,y:.65,strength:1});
  assert.ok(state.x>.5&&state.strength>.5);
  moveFor(3,1/60,{x:0,y:0,strength:0},state);
  assert.ok(Math.abs(state.x)<1e-8&&Math.abs(state.y)<1e-8);
  assert.ok(Math.abs(state.vx)<1e-7&&Math.abs(state.vy)<1e-7);
  assert.ok(state.strength<1e-7);
});

test('reduced motion immediately removes interaction and retained momentum',()=>{
  const state=moveFor(.3,1/60,{x:.7,y:-.8,strength:1});
  const returned=advancePointer(state,{x:1,y:1,strength:1},.016,true);
  assert.equal(returned,state);
  assert.deepEqual(state,createPointerMotion());
  advancePointer(state,{x:-1,y:.5,strength:1},.05,true);
  assert.deepEqual(state,createPointerMotion());
});

test('head roll preserves the 3D shape and changes its orientation without stretching',()=>{
  const transform=(matrix,vector)=>[0,1,2].map(row=>matrix[row]*vector[0]+matrix[row+3]*vector[1]+matrix[row+6]*vector[2]);
  for(const angles of [[-.25,-.1,.08],[.7,.2,-.2],[1.3,-.4,Math.PI/3]]){
    const matrix=rotationMatrix(...angles);
    for(const vector of [[1,0,0],[0,1,0],[0,0,1],[.3,-.8,1.2]])near(Math.hypot(...transform(matrix,vector)),Math.hypot(...vector),1e-6);
    const a=transform(matrix,[1,0,0]),b=transform(matrix,[0,1,0]);
    near(a.reduce((sum,value,i)=>sum+value*b[i],0),0,1e-6);
  }
  assert.notDeepEqual(rotationMatrix(.2,-.1,.15),rotationMatrix(.2,-.1,0));
});

test('all seven orbital objects retain distinct finite positions and close the orbit cleanly',()=>{
  for(const time of [0,13.2,47,140]){
    const positions=Array.from({length:7},(_,i)=>satellitePose(i,time));
    assert.equal(new Set(positions.map(p=>`${p.x.toFixed(5)},${p.y.toFixed(5)}`)).size,7);
    for(let i=0;i<7;i++){
      const p=positions[i],next=satellitePose(i,time+70);
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(Math.hypot(p.x,p.y)>1.1&&Math.hypot(p.x,p.y)<1.3,'icons should orbit around the face, not through its center');
      assert.ok(Math.abs(p.z)<=.28);
      assert.ok(p.scale>0&&p.scale<.3);
      for(const key of Object.keys(p))near(p[key],next[key]);
    }
  }
});

test('projected click targets use the same perspective and vertical orientation as the 3D scene',()=>{
  const center=projectScenePoint({x:0,y:0,z:.3},500);
  assert.deepEqual(center,{x:0,y:-0});
  const nearPoint=projectScenePoint({x:1,y:1,z:.4},500);
  const farPoint=projectScenePoint({x:1,y:1,z:-.4},500);
  assert.ok(nearPoint.x>farPoint.x&&nearPoint.y<farPoint.y,'nearer icons must project further from the center');
  near(nearPoint.x,.66*250*4.8/(4.8-.4));
  near(nearPoint.y,-nearPoint.x);
  for(let i=0;i<7;i++){
    const pose=satellitePose(i,19),small=projectScenePoint(pose,260),large=projectScenePoint(pose,520);
    near(large.x,small.x*2);near(large.y,small.y*2);
  }
});
