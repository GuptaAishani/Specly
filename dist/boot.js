// The standalone subscription server protects studio assets independently of
// this routing decision. Static previews remain an explicitly labeled demo.
try {
  const response=await fetch('./api/config',{headers:{Accept:'application/json'}});
  if(response.status===404 || (response.ok&&!response.headers.get('content-type')?.includes('application/json'))) {
    await import('./demo.js');
  } else {
    if(!response.ok)throw Error('The account service is temporarily unavailable.');
    globalThis.SPECLY_COMMERCIAL=true;
    const account=await fetch('./api/account').then(r=>r.ok?r.json():null);
    if(!account?.access)await import('./demo.js');
    else {globalThis.SPECLY_USER_ID=account.accountId;await import('./app.js');}
  }
} catch {
  document.querySelector('#app').innerHTML='<main style="max-width:640px;margin:10vh auto;padding:24px"><h1>Let’s reconnect.</h1><p>We couldn’t check your account. Refresh the page or open Account &amp; billing.</p><a href="./commerce.html">Account &amp; billing</a></main>';
}
