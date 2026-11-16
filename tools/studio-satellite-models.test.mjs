import test from 'node:test';
import assert from 'node:assert/strict';
import {SATELLITE_ORDER,buildSatelliteModel} from '../assets/studio-satellite-models.mjs';

test('all seven app sculptures have bounded, finite, genuinely volumetric geometry',()=>{
  assert.deepEqual(SATELLITE_ORDER,['stories','keys','bloom','muropolis','neon','food','dokupit']);
  for(const name of SATELLITE_ORDER){
    const {voxels,cell}=buildSatelliteModel(name);
    assert.ok(voxels instanceof Float32Array,name);
    assert.equal(voxels.length%8,0);
    const count=voxels.length/8;
    assert.ok(count>=40&&count<=1000,`${name}: ${count} prisms exceeds miniature budget`);
    assert.ok(Number.isFinite(cell)&&cell>0&&cell<.12);
    let low=Infinity,high=-Infinity,deep=0;
    for(let i=0;i<voxels.length;i+=8){
      const [x,y,z,depth,r,g,b,emission]=voxels.slice(i,i+8);
      assert.ok([x,y,z,depth,r,g,b,emission].every(Number.isFinite),name);
      assert.ok(Math.abs(x)+cell/2<=1&&Math.abs(y)+cell/2<=1,name+' planar bounds');
      assert.ok(z-depth/2>=-.5&&z+depth/2<=.5,name+' depth bounds');
      assert.ok(depth>0&&r>=0&&r<=1&&g>=0&&g<=1&&b>=0&&b<=1&&emission>=0&&emission<=1);
      low=Math.min(low,z-depth/2);high=Math.max(high,z+depth/2);if(depth>cell*2)deep++;
    }
    assert.ok(high-low>.35,name+' must have visible sides and a back');
    assert.ok(deep>count*.1,name+' must not become a single plane of shallow tiles');
  }
});

test('procedural models are deterministic and remain distinct from one another',()=>{
  const models=SATELLITE_ORDER.map(name=>buildSatelliteModel(name));
  SATELLITE_ORDER.forEach((name,i)=>assert.deepEqual(buildSatelliteModel(name),models[i],name));
  const fingerprints=models.map(({voxels})=>Buffer.from(voxels.buffer).toString('base64'));
  assert.equal(new Set(fingerprints).size,7);
  models[0].voxels.fill(0);
  assert.notDeepEqual(buildSatelliteModel('stories').voxels,models[0].voxels,'callers cannot corrupt a cached shared sculpture');
});

test('an unknown application cannot silently display the wrong miniature',()=>{
  for(const name of ['unknown','constructor','__proto__'])assert.throws(()=>buildSatelliteModel(name),RangeError);
});
