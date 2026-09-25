# Specly Stripe + Supabase completion checklist

The GitHub Pages frontend is now wired for Supabase Auth, Stripe Checkout, member access, billing management, and the 45-project member studio. The remaining steps are server-side setup in Supabase and Stripe.

## 1. Run the database migration

In Supabase, open **SQL Editor** and run the contents of:

`supabase/migrations/001_subscriptions.sql`

This creates `public.subscriptions` and an RLS policy that lets a signed-in user read only their own subscription row. Only trusted Edge Functions write subscription state.

## 2. Replace/deploy the four Edge Functions

In **Supabase → Edge Functions**, deploy these folders as functions with these exact names:

- `create-checkout` — JWT verification ON
- `create-portal` — JWT verification ON
- `member-projects` — JWT verification ON
- `stripe-webhook` — JWT verification OFF (Stripe cannot send a Supabase JWT; the function validates Stripe's webhook signature instead)

For `create-checkout`, replace the code currently deployed with `supabase/functions/create-checkout/index.ts`.

## 3. Supabase Edge Function secrets

You already added:

- `STRIPE_SECRET_KEY` = your restricted/live Stripe key
- `STRIPE_PRICE_ID` = `price_1UJbeuBdh9X3YzBg9YuYECxf`

Add one more secret after creating the Stripe webhook:

- `STRIPE_WEBHOOK_SECRET` = the signing secret beginning with `whsec_...`

Do not put `rk_live_...`, `sk_live_...`, or `whsec_...` in GitHub files.

## 4. Create the Stripe webhook

In Stripe, create a webhook destination pointing to:

`https://mpseexgimmtdfqtirohj.supabase.co/functions/v1/stripe-webhook`

Subscribe it to these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret (`whsec_...`) into the Supabase `STRIPE_WEBHOOK_SECRET` secret.

## 5. Enable Stripe Customer Portal

In Stripe Billing settings, configure the Customer Portal so customers can at minimum:

- update payment method
- view invoices/billing history
- cancel their subscription

The site's **Manage billing** button uses the `create-portal` Edge Function to open Stripe's hosted portal.

## 6. Supabase Auth URL configuration

In **Supabase → Authentication → URL Configuration**:

Site URL:

`https://GuptaAishani.github.io/Specly/`

Allowed redirect URL:

`https://GuptaAishani.github.io/Specly/commerce.html`

## 7. Upload the frontend to GitHub

For GitHub Pages, upload/replace the root frontend files from this ZIP:

- `.nojekyll`
- `index.html`
- `style.css`
- `boot.js`
- `demo.js`
- `samples.js`
- `sample-engine.js`
- `commerce.html`
- `commerce.css`
- `commerce.js`
- `app.js`
- `member-engine.js`

The `supabase/` folder is reference/deployment source for Supabase and is not required by GitHub Pages at runtime.

## 8. Live checkout verification

Because this project is using Stripe live mode, a checkout can create a real subscription. Verify in this order:

1. Open `/commerce.html` and sign in by email.
2. Continue to Stripe Checkout.
3. Complete checkout only with a real payment method when you intentionally want to create a live subscription.
4. Return to Specly; the page waits briefly for the Stripe webhook to update Supabase.
5. Confirm `public.subscriptions` contains your Supabase `user_id`, Stripe customer/subscription IDs, and status `trialing` or `active`.
6. Open the main site. `boot.js` should load `app.js` only for `trialing` or `active` members.
7. Open **Account & billing → Manage billing** and confirm Stripe Customer Portal opens.

## How access works

`boot.js` checks the signed-in Supabase user and reads only that user's `subscriptions` row. `trialing` and `active` statuses unlock `app.js`. The 45 member project briefs are returned by the protected `member-projects` Edge Function only after the server confirms the user has an active/trialing subscription.

This is stronger than hiding the paid project catalog in a public GitHub JavaScript file.
