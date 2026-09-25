import express from 'express';
import helmet from 'helmet';
import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizePhone,fingerprint,seal,unseal,entitlement,assertPrice,checkoutParameters} from './policy.mjs';
import {generateMission,evaluate} from '../studio/engine.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const checked=async query=>{const {data,error}=await query;if(error)throw error;return data};
const one=async query=>{const data=await checked(query);const row=Array.isArray(data)?(data.length===1?data[0]:null):data;if(!row||typeof row!=='object')throw Error('Expected one database record');return row};
const email=value=>{if(typeof value!=='string'||value.length>254||!/^\S+@\S+\.\S+$/.test(value))throw fail(400,'Enter a valid email address.');return value.trim().toLowerCase()};
const code=value=>{if(typeof value!=='string'||!/^\d{6,10}$/.test(value))throw fail(400,'Enter the code from your message.');return value};

export function configuration(env=process.env) {
  const required=['APP_ORIGIN','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID','STRIPE_PORTAL_CONFIG_ID','SESSION_ENCRYPTION_KEY','PHONE_HASH_KEY','SUPPORT_EMAIL','SELLER_NAME','TERMS_URL','PRIVACY_URL','REFUND_URL','TERMS_VERSION'];
  for(const key of required)if(!env[key])throw new Error('Missing '+key+'. See .env.example and docs/SUBSCRIPTION_LAUNCH.md.');
  if(!/^[0-9a-f]{64}$/i.test(env.SESSION_ENCRYPTION_KEY)||env.PHONE_HASH_KEY.length<32)throw new Error('Use a 32-byte hex session key and a separate phone hash secret of at least 32 characters.');
  const origin=new URL(env.APP_ORIGIN).origin,live=env.STRIPE_SECRET_KEY.startsWith('sk_live_');
  if(new URL(origin).protocol!=='https:' && !['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('APP_ORIGIN must use HTTPS.');
  for(const key of ['TERMS_URL','PRIVACY_URL','REFUND_URL'])if(new URL(env[key]).protocol!=='https:')throw new Error(key+' must be a public HTTPS policy URL.');
  if(live && (env.LAUNCH_READY!=='true'||env.EMAIL_SMS_READY!=='true'||env.BILLING_EMAILS_READY!=='true'||env.POLICIES_REVIEWED!=='true'||!env.TURNSTILE_SITE_KEY))throw new Error('Live billing is locked until launch settings, delivery, and policies are completed.');
  if(!['true','false'].includes(env.STRIPE_AUTOMATIC_TAX))throw new Error('Choose STRIPE_AUTOMATIC_TAX=true or false after reviewing tax obligations.');
  return {origin,live,supabaseUrl:env.SUPABASE_URL,anonKey:env.SUPABASE_ANON_KEY,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY,stripeKey:env.STRIPE_SECRET_KEY,webhookSecret:env.STRIPE_WEBHOOK_SECRET,priceId:env.STRIPE_PRICE_ID,portalConfig:env.STRIPE_PORTAL_CONFIG_ID,encryptionKey:env.SESSION_ENCRYPTION_KEY,hashKey:env.PHONE_HASH_KEY,support:email(env.SUPPORT_EMAIL),seller:env.SELLER_NAME,terms:env.TERMS_URL,privacy:env.PRIVACY_URL,refund:env.REFUND_URL,termsVersion:env.TERMS_VERSION,captchaKey:env.TURNSTILE_SITE_KEY||'',automaticTax:env.STRIPE_AUTOMATIC_TAX==='true',proxyHops:Number(env.TRUST_PROXY_HOPS||0)};
}

export async function createApp(config,{db,stripe,authFactory}={}) {
  db ||= createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  stripe ||= new Stripe(config.stripeKey,{maxNetworkRetries:2,timeout:15000});
  const authClient=authFactory||(()=>createClient(config.supabaseUrl,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
  assertPrice(await stripe.prices.retrieve(config.priceId));
  const portal=await stripe.billingPortal.configurations.retrieve(config.portalConfig);
  if(!portal.active||!portal.features.subscription_cancel.enabled)throw new Error('Enable cancellation in the selected Stripe customer portal configuration.');
  const app=express();app.disable('x-powered-by');app.set('trust proxy',config.proxyHops);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://challenges.cloudflare.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'",'https://challenges.cloudflare.com'],frameSrc:['https://challenges.cloudflare.com'],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"],upgradeInsecureRequests:config.origin.startsWith('https:')?[]:null}},referrerPolicy:{policy:'same-origin'}}));
  app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next()});
  const cookieName=config.origin.startsWith('https:')?'__Host-specly':'specly_local';
  const cookieOptions={httpOnly:true,secure:config.origin.startsWith('https:'),sameSite:'lax',path:'/',maxAge:7*86400000};
  const sessionKey=req=>{const entry=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));const raw=entry?.slice(cookieName.length+1);return raw&&/^[a-f0-9]{64}$/.test(raw)?fingerprint(raw,config.hashKey):null};
  async function rate(scope,identity,max,seconds) {
    const allowed=await checked(db.rpc('specly_rate',{p_bucket:fingerprint(scope+':'+identity,config.hashKey),p_max:max,p_seconds:seconds}));
    if(!allowed)throw fail(429,'Too many attempts. Please wait before trying again.');
  }
  async function saveSession(res,session) {
    const raw=randomBytes(32).toString('hex');
    await checked(db.from('specly_sessions').insert({id_hash:fingerprint(raw,config.hashKey),user_id:session.user.id,sealed_tokens:seal({access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at},config.encryptionKey),expires_at:new Date(Date.now()+7*86400000).toISOString()}));
    res.cookie(cookieName,raw,cookieOptions);
  }
  // Serialize refreshes per session in this process. Run one instance until a
  // cross-instance refresh lock is installed (see launch guide).
  const locks=new Map();
  async function locked(key,fn) {
    const prior=locks.get(key)||Promise.resolve();let release;const gate=new Promise(r=>release=r);const tail=prior.catch(()=>{}).then(()=>gate);locks.set(key,tail);
    await prior.catch(()=>{});try{return await fn()}finally{release();if(locks.get(key)===tail)locks.delete(key)}
  }
  async function identity(req) {
    const hash=sessionKey(req);if(!hash)throw fail(401,'Sign in to continue.');
    return locked(hash,async()=>{
      const row=await checked(db.from('specly_sessions').select('*').eq('id_hash',hash).maybeSingle());
      if(!row||Date.parse(row.expires_at)<=Date.now())throw fail(401,'Your session expired. Sign in again.');
      let tokens=unseal(row.sealed_tokens,config.encryptionKey);const client=authClient();
      if(tokens.expires_at*1000<Date.now()+60000){
        const {data,error}=await client.auth.refreshSession({refresh_token:tokens.refresh_token});
        if(error||!data.session)throw fail(401,'Your session expired. Sign in again.');
        tokens={access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at};
        await checked(db.from('specly_sessions').update({sealed_tokens:seal(tokens,config.encryptionKey)}).eq('id_hash',hash));
      }
      const {data,error}=await client.auth.getUser(tokens.access_token);
      if(error||!data.user||data.user.id!==row.user_id||!data.user.email_confirmed_at)throw fail(401,'Verify your email to continue.');
      return {user:data.user,tokens,hash};
    });
  }
  async function accountFor(user) {
    if(!user.phone||!user.phone_confirmed_at)throw fail(403,'Verify your phone number to continue.');
    try{return await one(db.rpc('specly_claim_account',{p_user:user.id,p_phone:fingerprint(normalizePhone('+'+user.phone.replace(/^\+/,'')),config.hashKey)}))}
    catch(error){if(error.code==='23505')throw fail(409,'This number is already linked to an account. Sign in to that account or contact support.');if(error.code==='P0001')throw fail(409,'Contact support to recover or change the phone number on this account.');throw error}
  }
  async function billing(account) {
    if(!account.stripe_customer_id)return entitlement([],config.priceId);
    const subscriptions=[];
    for await(const s of stripe.subscriptions.list({customer:account.stripe_customer_id,status:'all',limit:100,expand:['data.latest_invoice']}))subscriptions.push(s);
    const result=entitlement(subscriptions,config.priceId);
    if(result.trialUsed&&!account.trial_used){await checked(db.from('specly_accounts').update({trial_used:true}).eq('user_id',account.user_id));account.trial_used=true}
    return result;
  }
  async function paid(req,_res,next) {
    try{const {user}=await identity(req);const account=await accountFor(user);const status=await billing(account);if(!status.access)throw fail(402,'An active trial or subscription is required. Manage your plan from Account & billing.');req.specly={user,account,status};next()}catch(e){next(e)}
  }
  app.post('/api/stripe/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
    let event;try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],config.webhookSecret)}catch{return res.status(400).json({error:'Invalid webhook signature.'})}
    if(event.livemode!==config.live)return res.status(400).json({error:'Billing mode mismatch.'});
    // Entitlements always query Stripe's current state. Old/replayed events can
    // never re-enable access. Only the irreversible trial-used flag is updated.
    const obj=event.data.object;
    if((event.type.startsWith('customer.subscription.')&&obj.trial_start)||event.type==='checkout.session.completed') {
      const customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id;
      const account=customer?await checked(db.from('specly_accounts').select('*').eq('stripe_customer_id',customer).maybeSingle()):null;
      if(account){const status=await billing(account);if(status.trialUsed)await checked(db.from('specly_accounts').update({trial_used:true}).eq('user_id',account.user_id))}
    }
    await checked(db.from('specly_billing_events').upsert({id:event.id,event_type:event.type},{onConflict:'id',ignoreDuplicates:true}));
    res.json({received:true});
  });
  app.use(express.json({limit:'32kb'}));
  app.use('/api',async(req,_res,next)=>{try{if(req.method!=='GET'&&req.headers.origin!==config.origin)throw fail(403,'Request origin is not allowed.');await rate('api',req.ip,240,60);next()}catch(e){next(e)}});
  app.get('/api/config',(_req,res)=>res.json({mode:config.live?'live':'test',seller:config.seller,support:config.support,terms:config.terms,privacy:config.privacy,refund:config.refund,termsVersion:config.termsVersion,captchaKey:config.captchaKey}));
  app.post('/api/auth/email',async(req,res)=>{
    const address=email(req.body.email);await rate('email',address,3,600);await rate('email-ip',req.ip,10,600);
    if(config.captchaKey&&!req.body.captchaToken)throw fail(400,'Complete the security check.');
    const {error}=await authClient().auth.signInWithOtp({email:address,options:{shouldCreateUser:true,captchaToken:req.body.captchaToken}});
    if(error)throw fail(400,'Could not send a sign-in code. Check your address and security check, then try again.');
    res.json({message:'Check your email for a sign-in code.'});
  });
  app.post('/api/auth/email/verify',async(req,res)=>{
    const address=email(req.body.email);await rate('email-code',address,8,600);
    const {data,error}=await authClient().auth.verifyOtp({email:address,token:code(req.body.code),type:'email'});
    if(error||!data.session)throw fail(400,'The code is invalid or expired. Request another code.');
    const old=sessionKey(req);if(old)await checked(db.from('specly_sessions').delete().eq('id_hash',old));
    await saveSession(res,data.session);res.json({verified:true});
  });
  app.post('/api/auth/phone',async(req,res)=>{
    const {user,tokens}=await identity(req);if(user.phone_confirmed_at)throw fail(409,'Your phone is already verified. Contact support for number changes.');
    const phone=normalizePhone(req.body.phone);await rate('sms-user',user.id,3,600);await rate('sms-number',phone,3,600);await rate('sms-ip',req.ip,10,3600);
    const client=authClient();await client.auth.setSession(tokens);
    const {error}=await client.auth.updateUser({phone});
    if(error)throw fail(400,'Could not send a code. This number may already be linked to an account. Contact support if needed.');
    res.json({message:'Check your phone for a verification code.',phone});
  });
  app.post('/api/auth/phone/verify',async(req,res)=>{
    const {user,tokens,hash}=await identity(req);await rate('sms-code',user.id,8,600);
    const client=authClient();await client.auth.setSession(tokens);
    const {data,error}=await client.auth.verifyOtp({phone:normalizePhone(req.body.phone),token:code(req.body.code),type:'phone_change'});
    if(error)throw fail(400,'The code is invalid or expired. Request another code.');
    if(data.session)await checked(db.from('specly_sessions').update({sealed_tokens:seal({access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at},config.encryptionKey)}).eq('id_hash',hash));
    const verified=await identity(req);await accountFor(verified.user);res.json({verified:true});
  });
  app.post('/api/auth/logout',async(req,res)=>{const hash=sessionKey(req);if(hash)await checked(db.from('specly_sessions').delete().eq('id_hash',hash));res.clearCookie(cookieName,{...cookieOptions,maxAge:undefined});res.json({signedOut:true})});
  app.get('/api/account',async(req,res)=>{
    const {user}=await identity(req);
    if(!user.phone_confirmed_at)return res.json({email:user.email,phoneVerified:false,access:false});
    const account=await accountFor(user),status=await billing(account);
    res.json({accountId:user.id,email:user.email,phoneVerified:true,phoneEnding:user.phone.slice(-4),...status,trialUsed:account.trial_used||status.trialUsed,hasCustomer:!!account.stripe_customer_id});
  });
  app.post('/api/billing/checkout',async(req,res)=>{
    if(req.body.accepted!==true||req.body.termsVersion!==config.termsVersion)throw fail(400,'Accept the current subscription terms before continuing.');
    const {user}=await identity(req);const account=await accountFor(user);await rate('checkout',user.id,12,3600);
    let status=await billing(account);if(status.pending)throw fail(409,'You already have a subscription. Use Manage billing to update or cancel it.');
    if(!account.stripe_customer_id){
      const customer=await stripe.customers.create({email:user.email,metadata:{specly_user_id:user.id}},{idempotencyKey:'specly-customer-'+user.id});
      await checked(db.from('specly_accounts').update({stripe_customer_id:customer.id}).eq('user_id',user.id));account.stripe_customer_id=customer.id;
    }
    let attempt=await one(db.rpc('specly_attempt',{p_user:user.id}));
    let session;
    if(attempt.session_id)session=await stripe.checkout.sessions.retrieve(attempt.session_id);
    else for await(const s of stripe.checkout.sessions.list({customer:account.stripe_customer_id,limit:100})){if(s.metadata?.attempt_id===attempt.id){session=s;break}}
    if(session?.status==='open')return res.json({url:session.url});
    if(session?.status==='complete'){
      status=await billing(account);
      if(status.pending)throw fail(409,'Checkout is complete. Open Account & billing to refresh your access.');
      // Stripe completed checkout consumes trial eligibility even if the
      // subscription was canceled before a webhook arrived.
      if(attempt.trial){await checked(db.from('specly_accounts').update({trial_used:true}).eq('user_id',user.id));account.trial_used=true}
    }
    if(session||Date.parse(attempt.created_at)<Date.now()-23*3600000)attempt=await one(db.rpc('specly_attempt',{p_user:user.id,p_old:attempt.id}));
    await checked(db.from('specly_consents').insert({user_id:user.id,terms_version:config.termsVersion,offer:attempt.trial?'3 days free, then USD 15/month plus applicable tax until canceled':'USD 15/month plus applicable tax until canceled'}));
    session=await stripe.checkout.sessions.create(checkoutParameters(config,account,attempt,account.stripe_customer_id),{idempotencyKey:'specly-checkout-'+attempt.id});
    await checked(db.from('specly_checkout_attempts').update({session_id:session.id}).eq('user_id',user.id).eq('id',attempt.id));
    res.json({url:session.url});
  });
  app.post('/api/billing/portal',async(req,res)=>{
    const {user}=await identity(req);const account=await accountFor(user);if(!account.stripe_customer_id)throw fail(400,'No billing account yet.');
    const session=await stripe.billingPortal.sessions.create({customer:account.stripe_customer_id,configuration:config.portalConfig,return_url:config.origin+'/commerce.html'});res.json({url:session.url});
  });
  app.post('/api/verify',paid,async(req,res)=>{
    await rate('verification',req.specly.user.id,60,60);
    try{const {type,level,seed}=req.body.mission||{};const mission=generateMission(type,level,seed);res.json({result:evaluate(mission,req.body.design),testedAt:new Date().toISOString()})}catch{throw fail(400,'The mission or design parameters are invalid.')}
  });
  // Public allowlist: never expose source, .env, server files or database schema.
  for(const file of ['index.html','commerce.html','style.css','commerce.css','commerce.js','boot.js','demo.js','samples.js'])app.get('/'+file,(_req,res)=>res.sendFile(path.join(root,file)));
  app.get('/',(_req,res)=>res.sendFile(path.join(root,'index.html')));
  for(const file of ['app.js','engine.js'])app.get('/'+file,paid,(_req,res)=>res.sendFile(path.resolve(root,'../studio',file)));
  app.get('/healthz',(_req,res)=>res.json({ok:true}));
  app.use((_req,res)=>res.status(404).json({error:'Not found.'}));
  app.use((error,_req,res,_next)=>{
    const status=Number.isInteger(error.status)?error.status:503;
    // Do not log tokens, phone numbers, emails, request bodies or provider errors.
    if(status>=500)console.error('Specly service request failed:',error.code||error.type||'provider_unavailable');
    res.status(status).json({error:status>=500?'The service is temporarily unavailable. Please try again.':error.message});
  });
  return app;
}
