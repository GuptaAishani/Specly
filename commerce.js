import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mpseexgimmtdfqtirohj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FrtttA6zw63UzoVoeqs8XQ_21Mkp4oS";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);
const card = $("#account-card");
const messageBox = $("#account-message");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function message(text = "", error = false) {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.classList.toggle("error", error);
}
function setBusy(isBusy) { if (card) card.setAttribute("aria-busy", String(isBusy)); }
function formatDate(value){
  if(!value)return '';
  try{return new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return value}
}

async function getSubscription(userId){
  const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id',userId).maybeSingle();
  if(error) throw error;
  return data;
}

function renderSignedOut() {
  card.innerHTML = `
    <ol class="account-steps" aria-label="Account setup"><li aria-current="step">1. Email</li><li>2. Checkout</li><li>3. Build</li></ol>
    <h2>Start something worth building.</h2>
    <p>Enter your email and we’ll send you a secure sign-in link. After you sign in, you can start your 3-day trial.</p>
    <form id="signin-form">
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com">
      <button class="button primary" type="submit">Send sign-in link →</button>
    </form>
    <small>Signing in does not start your trial or charge you. Your trial begins only after you complete Stripe Checkout.</small>
    <a class="button ghost" style="margin-top:18px" href="./">Try the free samples</a>`;
  setBusy(false);
  $("#signin-form")?.addEventListener("submit", handleSignIn);
}

function renderCheckout(user, hasUsedTrial=false) {
  const trialCopy=hasUsedTrial?'This account has already used its introductory trial. Checkout will show the amount and billing date before you confirm.':'I authorize US$15/month plus applicable tax after my 3-day free trial, automatically renewed until I cancel. I can cancel before the trial ends to avoid the first charge.';
  card.innerHTML = `
    <ol class="account-steps" aria-label="Account setup"><li>1. Email</li><li aria-current="step">2. Checkout</li><li>3. Build</li></ol>
    <h2>Your project library is waiting.</h2>
    <p>Signed in as <strong>${esc(user.email || "")}</strong>.</p>
    <form id="checkout-form">
      <label class="consent-label"><input name="accepted" type="checkbox" required><span>${trialCopy}</span></label>
      <button class="button primary" type="submit">Continue to secure checkout →</button>
    </form>
    <small>Payment details are collected by Stripe. Specly never receives your full card number.</small>
    <div class="actions"><button class="textbutton" id="signout-button" type="button">Sign out</button></div>`;
  setBusy(false);
  $("#checkout-form")?.addEventListener("submit", handleCheckout);
  $("#signout-button")?.addEventListener("click", handleSignOut);
}

function renderMember(user, subscription){
  const trialing=subscription.status==='trialing';
  const end=trialing?subscription.trial_end:subscription.current_period_end;
  card.innerHTML=`
    <ol class="account-steps" aria-label="Account setup"><li>1. Email</li><li>2. Checkout</li><li aria-current="step">3. Build</li></ol>
    <p class="eyebrow">Membership ${trialing?'trial':'active'}</p>
    <h2>${trialing?'Your 3-day trial is active.':'Your Specly membership is active.'}</h2>
    <p>Signed in as <strong>${esc(user.email||'')}</strong>.</p>
    ${end?`<p>${trialing?'Trial ends':'Current billing period ends'} <strong>${esc(formatDate(end))}</strong>${subscription.cancel_at_period_end?' · cancellation scheduled':''}.</p>`:''}
    <div class="actions">
      <a class="button primary" href="./">Open member studio →</a>
      <button class="button ghost" id="portal-button" type="button">Manage billing</button>
      <button class="textbutton" id="signout-button" type="button">Sign out</button>
    </div>`;
  setBusy(false);
  $("#portal-button")?.addEventListener("click",handlePortal);
  $("#signout-button")?.addEventListener("click",handleSignOut);
}

async function handleSignIn(event) {
  event.preventDefault();
  const form = event.currentTarget, button=form.querySelector('button');
  const email = String(new FormData(form).get("email") || "").trim();
  if (!email) return;
  button.disabled=true; message("Sending your sign-in link…");
  try {
    const redirectTo = `${location.origin}${location.pathname}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo:redirectTo } });
    if(error)throw error;
    message("Check your email for the secure sign-in link.");
  } catch(error){console.error(error);message(error.message||"Could not send the sign-in link.",true)}
  finally{button.disabled=false}
}

async function handleCheckout(event){
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button');
  if(new FormData(form).get('accepted')!=='on'){message('Please accept the subscription terms before continuing.',true);return}
  button.disabled=true;message('Opening secure Stripe Checkout…');
  try{
    const {data:{session},error}=await supabase.auth.getSession();
    if(error)throw error;if(!session)throw Error('Your sign-in expired. Please sign in again.');
    const {data,error:fnError}=await supabase.functions.invoke('create-checkout',{body:{accepted:true}});
    if(fnError)throw fnError;if(!data?.url)throw Error(data?.error||'Stripe did not return a checkout URL.');
    location.assign(data.url);
  }catch(error){console.error(error);message(error.message||'Could not open Stripe Checkout.',true);button.disabled=false}
}

async function handlePortal(){
  const button=$("#portal-button");if(button)button.disabled=true;message('Opening Stripe billing…');
  try{
    const {data,error}=await supabase.functions.invoke('create-portal',{body:{}});
    if(error)throw error;if(!data?.url)throw Error(data?.error||'Billing portal did not return a URL.');
    location.assign(data.url);
  }catch(error){console.error(error);message(error.message||'Could not open billing.',true);if(button)button.disabled=false}
}

async function handleSignOut(){
  message('Signing out…');
  const {error}=await supabase.auth.signOut();
  if(error){message(error.message||'Could not sign out.',true);return}
  history.replaceState({},'',location.pathname);renderSignedOut();message('Signed out.');
}

async function waitForSubscription(userId, attempts=10){
  for(let i=0;i<attempts;i++){
    const sub=await getSubscription(userId);
    if(sub && ['trialing','active'].includes(sub.status))return sub;
    await new Promise(r=>setTimeout(r,1000));
  }
  return getSubscription(userId);
}

async function boot(){
  setBusy(true);
  try{
    const {data:{session},error}=await supabase.auth.getSession();if(error)throw error;
    const state=new URLSearchParams(location.search).get('checkout');
    if(!session?.user){renderSignedOut();if(state)history.replaceState({},'',location.pathname);return}

    let subscription;
    if(state==='success'){
      message('Checkout complete. Activating your membership…');
      subscription=await waitForSubscription(session.user.id);
      history.replaceState({},'',location.pathname);
    }else subscription=await getSubscription(session.user.id);

    if(subscription && ['trialing','active'].includes(subscription.status)){
      renderMember(session.user,subscription);
      message(state==='success'?'Membership activated.':'');
    }else{
      renderCheckout(session.user,Boolean(subscription));
      if(state==='cancelled'||state==='canceled')message('Checkout was canceled. No new subscription was completed.');
      else if(state==='success')message('Stripe completed checkout, but membership sync is still processing. Refresh in a few seconds if it does not appear.',true);
    }
  }catch(error){console.error(error);card.innerHTML='<h2>We couldn’t connect.</h2><p>Refresh this page and try again. No billing changes were made.</p>';setBusy(false);message(error.message||'Could not connect to Supabase.',true)}
}

supabase.auth.onAuthStateChange((_event,session)=>{if(!session?.user)renderSignedOut()});
boot();
