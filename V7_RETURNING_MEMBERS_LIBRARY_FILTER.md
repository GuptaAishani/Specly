# V7 — Returning members + difficulty filter

## What changed

- Supabase auth is explicitly configured to persist sessions, refresh tokens, and detect sign-in links.
- Returning members can sign in with the same email after closing or signing out of Specly; active/trialing memberships are recognized without another checkout.
- Public sample pages now show a clear **Member sign in** entry point separate from **Join Studio**.
- The account sign-in card now explains the difference between returning members and new members.
- The 45-project member library no longer renders all difficulties at once.
- Members choose **Easy**, **Medium**, or **Hard** from a dropdown and see 15 projects at a time.
- Project cards and workspace difficulty labels use Easy / Medium / Hard while the backend continues using beginner / intermediate / advanced status values.

## Returning-member flow

1. Open Specly.
2. If the browser still has a valid session, `boot.js` verifies the subscription and opens the member studio automatically.
3. If signed out, choose **Member sign in**, enter the membership email, and open the magic link.
4. `commerce.js` checks `public.subscriptions`. If the membership is `trialing` or `active`, it shows **Open member studio** rather than checkout.

No Stripe checkout is required again for an existing active member.
