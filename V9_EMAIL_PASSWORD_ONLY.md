# V9 — Email/password-only account login

Google sign-in has been removed from the Specly frontend.

## Current account flow
- Create account with email + password.
- Confirm email if Supabase email confirmation is enabled.
- Sign in later with the same email + password.
- Use **Forgot password** to recover access or to add a password to an older magic-link account.
- Returning members with a `trialing` or `active` subscription are sent back to the member studio without another checkout.

## Supabase redirect
Keep this URL in **Authentication → URL Configuration → Redirect URLs**:

`https://GuptaAishani.github.io/Specly/login.html`

It is used for account confirmation and password recovery.
