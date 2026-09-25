import test from 'node:test';
import assert from 'node:assert/strict';
import {memberProjects,generateMission,evaluate} from '../studio/engine.js';
test('member catalog contains 15 distinct briefs per difficulty, with stable canonical identities',()=>{
  const all=[];
  for(const level of ['beginner','intermediate','advanced']){
    const projects=memberProjects(level);assert.equal(projects.length,15);
    for(const type of ['structure','isolation','thermal'])assert.equal(projects.filter(m=>m.type===type).length,5);
    for(const m of projects){assert.deepEqual(generateMission(m.type,level,m.seed),m);assert.ok(m.context);assert.ok(m.deliverables);all.push(m)}
  }
  assert.equal(new Set(all.map(m=>m.scene)).size,45);assert.equal(new Set(all.map(m=>m.id)).size,45);
  assert.throws(()=>generateMission('thermal','beginner',1000000));
  assert.throws(()=>generateMission('structure','advanced',1000000));
});
test('every member brief has a feasible design inside its stated model and input limits',()=>{
  for(const level of ['beginner','intermediate','advanced'])for(const m of memberProjects(level)){
    let feasible=false;
    if(m.type==='structure')for(let width=15;width<=65&&!feasible;width+=5)for(let thickness=2;thickness<=12&&!feasible;thickness+=.5)feasible=evaluate(m,{length:m.requirements.minReach,width,thickness,material:'aluminum'}).pass;
    if(m.type==='isolation')for(let stiffness=200;stiffness<=6000&&!feasible;stiffness+=50)feasible=evaluate(m,{stiffness,damping:.1,mass:m.requirements.payload}).pass;
    if(m.type==='thermal')for(let width=60;width<=220&&!feasible;width+=5)feasible=evaluate(m,{length:m.requirements.maxLength,width,thickness:1,material:'aluminum'}).pass;
    assert.equal(feasible,true,m.id+' must be solvable');
  }
});
