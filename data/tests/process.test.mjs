import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stages, advancePlayback, clamp } from '../process.js';
import { buildScene } from '../model.js';
import { lookAt, perspective, multiply } from '../renderer.js';

test('eight stages include material explanations and official reference links',()=>{
  assert.equal(stages.length,8);
  for(const stage of stages) {
    assert.equal(stage.steps.length,3);
    assert.ok(stage.description.length>30);
    assert.ok(stage.materials.length>0);
    assert.ok(['semiconductor.samsung.com','news.lxsemicon.com'].includes(new URL(stage.source).hostname));
  }
});

test('playback advances across a stage boundary and carries the remaining time',()=>{
  const result=advancePlayback(2,.99,.2,1);
  assert.equal(result.stage,3);assert.ok(Math.abs(result.progress-.01)<1e-8);assert.equal(result.playing,true);
});

test('playback stops at the final package and never silently restarts',()=>{
  assert.deepEqual(advancePlayback(7,.99,.5,1),{stage:7,progress:1,playing:false});
  assert.deepEqual(advancePlayback(7,1,.5,2),{stage:7,progress:1,playing:false});
});

test('speed changes elapsed animation without changing manufacturing order',()=>{
  assert.ok(Math.abs(advancePlayback(0,0,1,2).progress-.2)<1e-8);
  assert.ok(Math.abs(advancePlayback(0,0,1,.5).progress-.05)<1e-8);
  assert.equal(clamp(NaN,0,1),0);
  assert.equal(clamp(-1,0,1),0);assert.equal(clamp(2,0,1),1);
});

test('all stages in both views produce complete finite geometry at the boundaries',()=>{
  for(let stage=0;stage<8;stage++) for(const section of [false,true]) for(const progress of [0,.35,.65,1]) {
    const scene=buildScene(stage,progress,section);
    assert.ok(scene.opaque.length>0,`stage ${stage}`);
    for(const buffer of [scene.opaque,scene.transparent]) {
      assert.equal(buffer.length%30,0,'triangle packing');
      for(let i=0;i<buffer.length;i+=10) {
        for(let k=0;k<10;k++) assert.ok(Number.isFinite(buffer[i+k]),`finite vertex at stage ${stage}`);
        assert.ok(Math.hypot(buffer[i+3],buffer[i+4],buffer[i+5])>.99,'valid normal');
        assert.ok(buffer[i+9]>0 && buffer[i+9]<=1,'valid opacity');
      }
    }
  }
});

test('each manufacturing stage changes its geometry as progress advances',()=>{
  for(let stage=0;stage<8;stage++) {
    for(const section of [false,true]) {
      const initial=buildScene(stage,0,section),final=buildScene(stage,1,section);
      assert.ok(!Buffer.from(initial.opaque.buffer).equals(Buffer.from(final.opaque.buffer)) || !Buffer.from(initial.transparent.buffer).equals(Buffer.from(final.transparent.buffer)),`stage ${stage}, section ${section}`);
    }
  }
});

test('camera matrices remain finite and project the target to the center',()=>{
  const view=lookAt([4,6,8],[0,.35,0]);
  const transform=multiply(perspective(.67,1.2,.1,60),view);
  assert.ok([...transform].every(Number.isFinite));
  const point=[0,.35,0,1];
  const projected=Array.from({length:4},(_,r)=>point.reduce((sum,n,i)=>sum+transform[i*4+r]*n,0));
  assert.ok(Math.abs(projected[0]/projected[3])<1e-6);
  assert.ok(Math.abs(projected[1]/projected[3])<1e-6);
  assert.ok(projected[2]/projected[3]>-1 && projected[2]/projected[3]<1);
});
