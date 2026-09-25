# Specly launch checklist

## Required before taking customers
- [ ] Replace `YOUR_SUPPORT_EMAIL` in `contact.html` with a real monitored support email.
- [ ] Make the same support email visible in Stripe receipts/customer portal settings.
- [ ] Confirm Supabase Site URL and Redirect URL point to the final public domain.
- [ ] Confirm `subscriptions` table exists and RLS is enabled.
- [ ] Confirm these Edge Functions are deployed:
  - `create-checkout` (JWT ON)
  - `create-portal` (JWT ON)
  - `member-projects` (JWT ON)
  - `stripe-webhook` (JWT OFF)
- [ ] Confirm Supabase secrets exist:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PRICE_ID`
  - `STRIPE_WEBHOOK_SECRET`
- [ ] Confirm Stripe webhook receives:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- [ ] Enable and configure Stripe Customer Portal.
- [ ] Run one complete real customer flow from signed-out visitor to active membership.
- [ ] Verify cancellation updates the `subscriptions` row correctly.
- [ ] Test Chrome, Safari, and a mobile browser.
- [ ] Click every nav, CTA, legal, and billing link.
- [ ] Search the repo for `YOUR_`, `TODO`, `localhost`, and placeholder copy.

## Legal / trust
- [ ] Review `terms.html`, `privacy.html`, and `refund.html` for your actual business practices.
- [ ] Have a qualified attorney review them when practical, especially before broad commercial scaling.
- [ ] If you add analytics/advertising pixels, update `privacy.html` before enabling them.
- [ ] Keep recurring billing language consistent: first 3 days free, then US$15/month plus applicable tax until canceled.

## Marketing readiness
- [ ] Add a custom domain if desired and then update Supabase/Stripe return URLs.
- [ ] Add a logo/social preview image.
- [ ] Prepare 5–10 product-free-sample videos.
- [ ] Add an analytics provider only after deciding what you truly need to measure.
- [ ] Track at minimum: sample opened, membership CTA clicked, checkout started, checkout completed.
- [ ] Collect feedback from 5–10 engineering students before a large launch.

## Security
- [ ] Never commit `rk_live_`, `sk_live_`, or `whsec_` values to GitHub.
- [ ] Keep the Stripe restricted key permissions limited to what Specly needs.
- [ ] Ensure only server-side webhook/function code can write subscription status.
