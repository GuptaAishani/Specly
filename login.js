import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mpseexgimmtdfqtirohj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FrtttA6zw63UzoVoeqs8XQ_21Mkp4oS";
const LOGIN_URL = "https://GuptaAishani.github.io/Specly/login.html";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const card = document.querySelector('#auth-card');
const messageBox = document.querySelector('#auth-message');
const params = new URLSearchParams(location.search);
let mode = params.get('mode') || 'signin';
let routing = false;
let recoveryMode = mode === 'recovery';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setBusy(value){ card?.setAttribute('aria-busy', String(value)); }
function message(text='', error=false){
  if(!messageBox) return;
  messageBox.textContent = text;
  messageBox.classList.toggle('error', error);
}
function setMode(next){
  mode = next;
  recoveryMode = next === 'recovery';
  const url = new URL(location.href);
  if(next === 'signin') url.searchParams.delete('mode');
  else url.searchParams.set('mode', next);
  history.replaceState({}, '', url.pathname + url.search);
  renderMode();
}
function authTabs(active){
  return `<div class="auth-tabs" role="tablist" aria-label="Account options">
    <button class="auth-tab ${active==='signin'?'active':''}" type="button" data-mode="signin" role="tab" aria-selected="${active==='signin'}">Sign in</button>
    <button class="auth-tab ${active==='signup'?'active':''}" type="button" data-mode="signup" role="tab" aria-selected="${active==='signup'}">Create account</button>
  </div>`;
}
function bindCommon(){
  card.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  card.querySelectorAll('[data-toggle-password]').forEach(btn => btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.togglePassword);
    if(!target) return;
    const show = target.type === 'password';
    target.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  }));
}

function renderSignIn(){
  card.innerHTML = `${authTabs('signin')}
    <h2>Welcome back.</h2>
    <p class="auth-subtitle">Sign in to your Specly account. Active members go straight back to the project studio.</p>
    <form id="signin-form">
      <label for="signin-email">Email</label>
      <input id="signin-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
      <div class="password-row"><label for="signin-password">Password</label><button type="button" data-toggle-password="signin-password">Show</button></div>
      <input id="signin-password" name="password" type="password" autocomplete="current-password" required>
      <button class="auth-submit" type="submit">Sign in →</button>
    </form>
    <p class="auth-linkline"><button type="button" data-mode="forgot">Forgot password?</button></p>
    <p class="auth-note">Used Specly's old email-link sign in before? Choose <strong>Forgot password</strong> once to create a password for that same account.</p>`;
  setBusy(false); bindCommon();
  card.querySelector('#signin-form')?.addEventListener('submit', handlePasswordSignIn);
}

function renderSignUp(){
  card.innerHTML = `${authTabs('signup')}
    <h2>Create your Specly account.</h2>
    <p class="auth-subtitle">One account keeps your sign-in, membership, and billing access together.</p>
    <form id="signup-form">
      <label for="signup-name">Name</label>
      <input id="signup-name" name="name" type="text" autocomplete="name" maxlength="80" placeholder="Your name">
      <label for="signup-email">Email</label>
      <input id="signup-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
      <div class="password-row"><label for="signup-password">Password</label><button type="button" data-toggle-password="signup-password">Show</button></div>
      <input id="signup-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
      <p class="password-rules">Use at least 8 characters.</p>
      <label for="signup-confirm">Confirm password</label>
      <input id="signup-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
      <label class="auth-checkbox"><input name="accepted" type="checkbox" required><span>I agree to the <a href="./terms.html" target="_blank" rel="noopener">Terms</a> and acknowledge the <a href="./privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
      <button class="auth-submit" type="submit">Create account →</button>
    </form>
    <p class="auth-note">Already used Specly with an email sign-in link? Don't make a second account. Use <strong>Sign in → Forgot password</strong> to add a password to your existing account.</p>`;
  setBusy(false); bindCommon();
  card.querySelector('#signup-form')?.addEventListener('submit', handleSignUp);
}

function renderForgot(){
  card.innerHTML = `<button class="auth-textbutton" type="button" data-mode="signin">← Back to sign in</button>
    <h2 style="margin-top:22px">Reset your password.</h2>
    <p class="auth-subtitle">We'll email you a secure recovery link. This also works if your Specly account was originally created with the old email-link sign in.</p>
    <form id="forgot-form">
      <label for="forgot-email">Email</label>
      <input id="forgot-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
      <button class="auth-submit" type="submit">Send password reset →</button>
    </form>`;
  setBusy(false); bindCommon();
  card.querySelector('#forgot-form')?.addEventListener('submit', handleForgot);
}

function renderSetPassword(user, fromRecovery=false){
  const email = user?.email || '';
  card.innerHTML = `<p class="eyebrow">${fromRecovery?'Password recovery':'Sign-in settings'}</p>
    <h2>${fromRecovery?'Choose a new password.':'Set or change your password.'}</h2>
    <p class="auth-subtitle">${email?`This password will be used for <strong>${esc(email)}</strong>.`:''} Use this password whenever you return to Specly.</p>
    <form id="password-form">
      <div class="password-row"><label for="new-password">New password</label><button type="button" data-toggle-password="new-password">Show</button></div>
      <input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
      <p class="password-rules">Use at least 8 characters.</p>
      <label for="new-password-confirm">Confirm new password</label>
      <input id="new-password-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
      <button class="auth-submit" type="submit">Save password →</button>
    </form>
    ${fromRecovery?'':`<p class="auth-linkline"><a href="./commerce.html">Back to account &amp; billing</a></p>`}`;
  setBusy(false); bindCommon();
  card.querySelector('#password-form')?.addEventListener('submit', handleSetPassword);
}

function renderCheckEmail(email, kind='confirmation'){
  card.innerHTML = `<p class="eyebrow">Check your inbox</p>
    <h2>${kind==='reset'?'Password reset sent.':'Confirm your email.'}</h2>
    <p class="auth-subtitle">We sent a secure email to <strong>${esc(email)}</strong>.</p>
    <div class="signed-in-box"><strong>${kind==='reset'?'Open the password reset email.':'Open the confirmation email.'}</strong><span>${kind==='reset'?'The link will bring you back here to choose a new password.':'After confirming, you’ll come back to Specly and can continue.'}</span></div>
    <div class="auth-actions"><button class="button ghost" type="button" data-mode="signin">Back to sign in</button></div>`;
  setBusy(false); bindCommon();
}

function renderSignedIn(user){
  card.innerHTML = `<p class="eyebrow">Signed in</p><h2>Your account is ready.</h2><p class="auth-subtitle">Signed in as <strong>${esc(user.email || '')}</strong>.</p><div class="auth-actions"><a class="button primary" href="./">Open Specly →</a><a class="button ghost" href="./commerce.html">Account &amp; billing</a></div>`;
  setBusy(false);
}

function renderMode(){
  message('');
  if(mode === 'signup') renderSignUp();
  else if(mode === 'forgot') renderForgot();
  else renderSignIn();
}

async function getSubscription(userId){
  const { data, error } = await supabase.from('subscriptions').select('status').eq('user_id', userId).maybeSingle();
  if(error) throw error;
  return data;
}
async function routeAfterAuth(user){
  if(routing || recoveryMode) return;
  routing = true;
  message('Signing you in…');
  try{
    const next = params.get('next');
    if(next === 'account' || next === 'checkout'){
      location.replace('./commerce.html');
      return;
    }
    const subscription = await getSubscription(user.id);
    if(subscription && ['trialing','active'].includes(subscription.status)) location.replace('./');
    else location.replace('./commerce.html');
  }catch(error){
    routing = false;
    console.error(error);
    renderSignedIn(user);
    message('Signed in. We could not check membership automatically, so choose where to continue.', true);
  }
}

async function handlePasswordSignIn(event){
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  button.disabled = true; message('Signing in…');
  try{
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) throw error;
    if(!data.user) throw new Error('Could not sign in.');
    await routeAfterAuth(data.user);
  }catch(error){
    console.error(error);
    const msg = /invalid login credentials/i.test(error?.message || '')
      ? 'Email or password is incorrect. If you previously used Specly’s email-link sign in, use Forgot password to create a password.'
      : (error?.message || 'Could not sign in.');
    message(msg, true); button.disabled = false;
  }
}

async function handleSignUp(event){
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  const confirm = String(fd.get('confirm') || '');
  if(password !== confirm){ message('Those passwords do not match.', true); return; }
  if(password.length < 8){ message('Use a password with at least 8 characters.', true); return; }
  button.disabled = true; message('Creating your account…');
  try{
    const redirectTo = buildLoginRedirect();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: name ? { full_name: name } : {} }
    });
    if(error) throw error;
    if(data.user?.identities && data.user.identities.length === 0){
      message('An account with this email may already exist. Try Sign in or Forgot password instead.', true);
      button.disabled = false; return;
    }
    if(data.session?.user) await routeAfterAuth(data.session.user);
    else renderCheckEmail(email, 'confirmation');
  }catch(error){ console.error(error); message(error?.message || 'Could not create your account.', true); button.disabled = false; }
}

async function handleForgot(event){
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  const email = String(new FormData(form).get('email') || '').trim();
  button.disabled = true; message('Sending password reset…');
  try{
    const redirectTo = `${LOGIN_URL}?mode=recovery${params.get('next') ? `&next=${encodeURIComponent(params.get('next'))}` : ''}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if(error) throw error;
    renderCheckEmail(email, 'reset');
  }catch(error){ console.error(error); message(error?.message || 'Could not send the password reset email.', true); button.disabled = false; }
}

async function handleSetPassword(event){
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  const fd = new FormData(form);
  const password = String(fd.get('password') || '');
  const confirm = String(fd.get('confirm') || '');
  if(password !== confirm){ message('Those passwords do not match.', true); return; }
  if(password.length < 8){ message('Use a password with at least 8 characters.', true); return; }
  button.disabled = true; message('Saving your password…');
  try{
    const { data, error } = await supabase.auth.updateUser({ password });
    if(error) throw error;
    message('Password saved. Signing you in…');
    recoveryMode = false;
    const url = new URL(location.href); url.searchParams.delete('mode'); history.replaceState({}, '', url.pathname + url.search);
    await routeAfterAuth(data.user);
  }catch(error){ console.error(error); message(error?.message || 'Could not save your password.', true); button.disabled = false; }
}

function buildLoginRedirect(){
  const next = params.get('next');
  return next ? `${LOGIN_URL}?next=${encodeURIComponent(next)}` : LOGIN_URL;
}

supabase.auth.onAuthStateChange((event, session) => {
  if(event === 'PASSWORD_RECOVERY' && session?.user){
    recoveryMode = true; mode = 'recovery'; renderSetPassword(session.user, true); message('Recovery link accepted. Choose your new password.');
  } else if(event === 'SIGNED_IN' && session?.user && !recoveryMode && mode !== 'set-password'){
    routeAfterAuth(session.user);
  }
});

async function boot(){
  setBusy(true);
  try{
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    if(hash.get('error_description')) message(decodeURIComponent(hash.get('error_description')), true);
    const { data:{ session }, error } = await supabase.auth.getSession();
    if(error) throw error;
    if((mode === 'recovery' || mode === 'set-password') && session?.user){
      recoveryMode = mode === 'recovery';
      renderSetPassword(session.user, mode === 'recovery');
      return;
    }
    if(session?.user){ await routeAfterAuth(session.user); return; }
    renderMode();
  }catch(error){ console.error(error); renderMode(); message(error?.message || 'Could not connect to the sign-in service.', true); }
}

boot();
