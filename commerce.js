import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mpseexgimmtdfqtirohj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FrtttA6zw63UzoVoeqs8XQ_21Mkp4oS";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const AUTH_REDIRECT_URL = "https://GuptaAishani.github.io/Specly/commerce.html";

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

async function handleSignIn(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button');
  const email = String(new FormData(form).get("email") || "").trim();

  if (!email || button.disabled) return;

  button.disabled = true;
  button.classList.remove('email-sent');
  button.textContent = 'Sending…';
  message("Sending your secure sign-in link…");

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL }
    });

    if (error) throw error;

    message(`Email sent to ${email}. Open the newest email and click the sign-in link to return to Specly.`);
    button.classList.add('email-sent');
    button.textContent = 'Email sent ✓';

    // Let the user request another link whenever they choose.
    setTimeout(() => {
      button.disabled = false;
      button.classList.remove('email-sent');
      button.textContent = 'Send another sign-in link →';
    }, 1800);

  } catch (error) {
    console.error(error);

    const rateLimited =
      error?.status === 429 ||
      error?.code === 'over_email_send_rate_limit' ||
      /rate limit|only request this after/i.test(error?.message || '');

    if (rateLimited) {
      message(
        "Supabase is temporarily limiting repeated email sends. Wait a moment, then click the button again.",
        true
      );
    } else {
      message(error?.message || "Could not send the sign-in link.", true);
    }

    button.disabled = false;
    button.classList.remove('email-sent');
    button.textContent = 'Send sign-in link →';
  }
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
