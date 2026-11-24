import assert from "node:assert/strict";
import {specimens,makeTargets} from "./specimens.js";
import {describePose,gestureTracker,mirroredPoint} from "./hands.js";
import {project,worldPoint,cameraMatrix} from "./renderer.js";

assert.equal(new Set(specimens.map(s=>s.id)).size,19);
for(const {id} of specimens) {
  const original=makeTargets(id,1200);
  assert.deepEqual(original,makeTargets(id,1200));
  assert(original.every(Number.isFinite),id);
  for(let n=1;n<=4;n++) {
    const changed=makeTargets(id,1200,n);
    assert(changed.every(Number.isFinite),id+" morph "+n);
    for(let i=3;i<changed.length;i+=4) assert.equal(changed[i],original[i]);
  }
}
assert.deepEqual(mirroredPoint(.9,.5,640,480,400,840),{x:-248.00000000000003,y:420});
const s={scale:120,cx:500,cy:400,matrix:new Float32Array(9)}, xyzw=new Float32Array(3),screen=new Float32Array(3);
cameraMatrix([.2,.7,-.3],s.matrix);
worldPoint(600,320,s,xyzw);project(...xyzw,s,screen);
assert(Math.abs(screen[0]-600)<.002&&Math.abs(screen[1]-320)<.002);
function frame(n) {
  const points=Array.from({length:21},()=>({x:.5,y:.52,z:0}));
  points[0]={x:.49,y:.77,z:0};
  points[9]={x:.49,y:.55,z:0};
  points[4]={x:.20,y:.45,z:0};
  [8,12,16,20].forEach((tip,i)=>{
    points[tip-2]={x:.40+i*.07,y:.56,z:0};
    points[tip]={x:.40+i*.07,y:i<n?.29:.58,z:0};
  });
  return points;
}
const input=frame(4);
assert.equal(describePose(input).fingers,4);
const tracker=gestureTracker();
assert.equal(tracker.update([input],0,.55,false).kind,"idle");
assert.equal(tracker.update([input],140,.55,false).kind,"open");
tracker.reset();
assert.equal(tracker.update([frame(3)],200,.54,true).morph,0);
assert.equal(tracker.update([frame(3)],422,.54,true).morph,4);
tracker.reset();
assert.equal(tracker.update([frame(1)],260,.54,false).kind,"idle");
assert.equal(tracker.update([frame(1)],408,.54,false).kind,"point");
console.log("Geometry, color preservation, projection and gesture debounce passed.");
