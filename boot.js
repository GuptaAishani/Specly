import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mpseexgimmtdfqtirohj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FrtttA6zw63UzoVoeqs8XQ_21Mkp4oS";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function hasMemberAccess(userId){
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['trialing','active'])
    .maybeSingle();
  if(error) throw error;
  return Boolean(data);
}

try {
  const { data:{ session }, error } = await supabase.auth.getSession();
  if(error) throw error;

  if(!session?.user){
    await import('./demo.js');
  } else if(await hasMemberAccess(session.user.id)){
    globalThis.SPECLY_COMMERCIAL = true;
    globalThis.SPECLY_USER_ID = session.user.id;
    globalThis.SPECLY_SUPABASE = supabase;
    await import('./app.js');
  } else {
    globalThis.SPECLY_USER_ID = session.user.id;
    await import('./demo.js');
  }
} catch (error) {
  console.error(error);
  document.querySelector('#app').innerHTML = '<main style="max-width:640px;margin:10vh auto;padding:24px"><h1>Let’s reconnect.</h1><p>We couldn’t check your account. Refresh the page or open Account &amp; billing.</p><a href="./commerce.html">Account &amp; billing</a></main>';
}
