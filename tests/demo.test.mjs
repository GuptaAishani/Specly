import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {samples} from '../dist/samples.js';
test('public demo has exactly one sample per level and no full studio assets',()=>{
  assert.deepEqual(samples.map(s=>s.level),['beginner','intermediate','advanced']);
  assert.equal(new Set(samples.map(s=>s.type)).size,3);
  for(const s of samples)assert.equal(s.options.length,3);
  for(const file of ['app.js','engine.js'])assert.equal(fs.existsSync(new URL('../dist/'+file,import.meta.url)),false);
});
test('sample selection and testing work without browser storage or downloads',()=>{
  const app={innerHTML:''},handlers={};
  const context=vm.createContext({samples,document:{querySelector:()=>app,addEventListener:(event,fn)=>handlers[event]=fn},window:{scrollTo(){}}});
  vm.runInContext(fs.readFileSync(new URL('../dist/demo.js',import.meta.url),'utf8').replace(/^import .*?;\n/,''),context);
  assert.ok(app.innerHTML.includes('Try a small sample'));
  handlers.click({target:{closest:selector=>selector==='[data-sample]'?{dataset:{sample:'1'}}:null}});
  assert.ok(app.innerHTML.includes('intermediate · limited sample'));
  handlers.click({target:{closest:selector=>selector==='[data-test]'?{}:null}});
  assert.ok(app.innerHTML.includes('Sample results'));
  assert.ok(app.innerHTML.includes('Unlock saving & exports'));
});
