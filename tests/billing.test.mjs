import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {normalizePhone,fingerprint,seal,unseal,entitlement,checkoutParameters,assertPrice} from '../server/policy.mjs';
import {createApp,configuration} from '../server/app.mjs';
import {generateMission,evaluate,initialDesign} from '../studio/engine.js';

const price={id:'price_test',active:true,currency:'usd',unit_amount:1500,recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};
const sub=(status='trialing',overrides={})=>({id:'sub_1',status,trial_start:100,trial_end:2000,items:{data:[{price:{id:price.id},current_period_end:3000}]},latest_invoice:{status:'paid'},...overrides});
test('trial expires at its exact deadline; paid, past-due, canceled and unrelated-price states fail closed',()=>{
  assert.equal(entitlement([sub()],price.id,1999).access,true);
  assert.equal(entitlement([sub()],price.id,2000).access,false);
  assert.equal(entitlement([sub('active')],price.id,2000).access,true);
  for(const status of ['past_due','canceled','unpaid','paused','incomplete'])assert.equal(entitlement([sub(status)],price.id,1000).access,false);
  assert.equal(entitlement([sub('active',{latest_invoice:{status:'open'}})],price.id,1000).access,false);
  assert.equal(entitlement([sub()], 'another_price',1000).access,false);
  assert.equal(entitlement([sub('active')],price.id,3000).access,false);
});
test('cancellation does not reset trial history and scheduled cancellation preserves remaining access',()=>{
  assert.equal(entitlement([sub('canceled')],price.id,1000).trialUsed,true);
  const result=entitlement([sub('trialing',{cancel_at_period_end:true})],price.id,1000);
  assert.equal(result.access,true);assert.equal(result.cancelAtPeriodEnd,true);
});
test('equivalent phone formats make one fingerprint; country code and valid number required',()=>{
  const a=normalizePhone('+1 (415) 555-0123'),b=normalizePhone('+14155550123');assert.equal(a,b);
  assert.equal(fingerprint(a,'a'.repeat(40)),fingerprint(b,'a'.repeat(40)));
  assert.throws(()=>normalizePhone('4155550123'));assert.throws(()=>normalizePhone('+123'));
});
test('encrypted session tokens reject tampering and the wrong key',()=>{
  const key='ab'.repeat(32),sealed=seal({secret:'not-in-plaintext'},key);assert.deepEqual(unseal(sealed,key),{secret:'not-in-plaintext'});
  assert.ok(!sealed.includes('not-in-plaintext'));assert.throws(()=>unseal(sealed,'cd'.repeat(32)));
  const bytes=Buffer.from(sealed,'base64');bytes[bytes.length-1]^=1;assert.throws(()=>unseal(bytes.toString('base64'),key));
});
test('checkout binds the server price, card collection, consent and exact trial offer; returning users receive no trial',()=>{
  const config={origin:'https://specly.example',priceId:price.id,automaticTax:false,termsVersion:'v1'};
  const trial=checkoutParameters(config,{user_id:'u1'},{id:'a1',trial:true},'cus_1');
  assert.equal(trial.line_items[0].price,price.id);assert.equal(trial.subscription_data.trial_period_days,3);
  assert.equal(trial.payment_method_collection,'always');assert.equal(trial.consent_collection.terms_of_service,'required');
  assert.equal(trial.customer,'cus_1');assert.equal(trial.metadata.specly_user_id,'u1');
  assert.equal(checkoutParameters(config,{user_id:'u1'},{id:'a2',trial:false},'cus_1').subscription_data.trial_period_days,undefined);
});
test('wrong price configuration and missing production setup are rejected',()=>{
  assertPrice(price);for(const patch of [{unit_amount:15000},{currency:'eur'},{active:false},{recurring:{interval:'year',interval_count:1}}])assert.throws(()=>assertPrice({...price,...patch}));
  assert.throws(()=>configuration({}),/Missing APP_ORIGIN/);
});

// HTTP integration tests use provider doubles, never production credentials.
async function fixture(t,{signedIn=false,status='trialing',phoneVerified=true,emailVerified=true,providerDown=false}={}) {
  const config={origin:'http://localhost:3000',live:false,priceId:price.id,portalConfig:'bpc_test',hashKey:'k'.repeat(40),encryptionKey:'ab'.repeat(32),support:'help@example.com',seller:'Test seller',terms:'https://example.com/terms',privacy:'https://example.com/privacy',refund:'https://example.com/refunds',termsVersion:'v1',proxyHops:0,webhookSecret:'test-only'};
  const user={id:'user_1',email:'person@example.com',email_confirmed_at:emailVerified?'2026-01-01':null,phone:'14155550123',phone_confirmed_at:phoneVerified?'2026-01-01':null};
  const now=Math.floor(Date.now()/1000),account={user_id:user.id,stripe_customer_id:'cus_1',trial_used:true};
  const sessions={id_hash:'unused',user_id:user.id,expires_at:new Date(Date.now()+86400000).toISOString(),sealed_tokens:seal({access_token:'fixture',refresh_token:'fixture',expires_at:now+3600},config.encryptionKey)};
  const db={rpc:async(name)=>({data:name==='specly_rate'?true:[account],error:null}),from:table=>{let result=table==='specly_sessions'?sessions:account;const query={select(){return this},eq(){return this},update(){return this},insert(){return this},upsert(){return this},delete(){return this},maybeSingle(){return Promise.resolve({data:result,error:null})},then(resolve){return Promise.resolve({data:result,error:null}).then(resolve)}};return query}};
  const stripe={prices:{retrieve:async()=>price},billingPortal:{configurations:{retrieve:async()=>({active:true,features:{subscription_cancel:{enabled:true}}})}},subscriptions:{list:async function*(){if(providerDown)throw Error('offline');yield sub(status,{trial_end:status==='expired'?now-1:now+3600,status:status==='expired'?'trialing':status,items:{data:[{price:{id:price.id},current_period_end:now+3600}]}})}},webhooks:{constructEvent(){throw Error('Invalid signature')}}};
  const app=await createApp(config,{db,stripe,authFactory:()=>({auth:{getUser:async()=>({data:{user},error:null})}})});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const headers=signedIn?{Cookie:'specly_local='+'a'.repeat(64)}:{};
  return {request:(route,opts={})=>fetch(base+route,{...opts,headers:{...headers,...opts.headers}}),config};
}
test('anonymous visitors cannot fetch paid assets, verify designs, or read server source',async t=>{
  const {request}=await fixture(t);
  assert.equal((await request('/demo.js')).status,200);
  assert.equal((await request('/samples.js')).status,200);
  for(const asset of ['/app.js','/engine.js'])assert.equal((await request(asset)).status,401);
  assert.equal((await request('/api/verify',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:'{}'})).status,401);
  for(const secret of ['/server/app.mjs','/.env','/migrations/001_subscriptions.sql'])assert.equal((await request(secret)).status,404);
});
test('cross-origin mutations and unsigned Stripe webhooks are rejected',async t=>{
  const {request}=await fixture(t);
  assert.equal((await request('/api/auth/logout',{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await request('/api/stripe/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,400);
});
test('expired, unverified and provider-unavailable sessions cannot open the paid studio',async t=>{
  for(const options of [{status:'expired'},{status:'past_due'},{phoneVerified:false},{emailVerified:false},{providerDown:true}]) {
    const {request}=await fixture(t,{signedIn:true,...options});const r=await request('/app.js');assert.ok([401,402,403,503].includes(r.status));
  }
});
test('paid verification reconstructs canonical mission limits and ignores tampered client requirements',async t=>{
  const {request,config}=await fixture(t,{signedIn:true});
  const mission=generateMission('structure','beginner',3),design=initialDesign(mission),expected=evaluate(mission,design);
  mission.requirements.maxDeflection=1e20;mission.requirements.minSafety=0;
  const r=await request('/api/verify',{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({mission,design})});
  assert.equal(r.status,200);const body=await r.json();assert.deepEqual(body.result.checks,expected.checks);assert.ok(Date.parse(body.testedAt));
  assert.equal((await request('/app.js')).status,200);
});
