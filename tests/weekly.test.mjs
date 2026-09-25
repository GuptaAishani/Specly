import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyCollection,generateMission} from '../studio/engine.js';
test('weekly picks remain stable all week and rotate at Monday UTC without altering saved briefs',()=>{
  const first=weeklyCollection('2026-09-21T00:00:00Z'),last=weeklyCollection('2026-09-27T23:59:59Z'),next=weeklyCollection('2026-09-28T00:00:00Z');
  assert.deepEqual(first,last);assert.equal(first.next,next.starts);
  const saved=generateMission('structure','beginner',first.seeds.structure);
  assert.notEqual(saved.scene,generateMission('structure','beginner',next.seeds.structure).scene);
  assert.equal(saved.seed,first.seeds.structure);assert.throws(()=>weeklyCollection('bad-date'));
});
