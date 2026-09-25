# Specly subscription launch

## Current state — September 25, 2026

The repository includes a standalone Node subscription server, email-code and SMS verification screens, a unique verified-phone account constraint, Stripe Checkout, account billing portal, signed webhook handling, and server-enforced studio access. The private Sites preview and GitHub Pages are explicitly **demo-only**. They cannot collect money, send verification messages, or enforce commercial access.

The Supabase integration was installed during this task, but its project-management tools were not exposed to the active session, so no project could be inspected or configured. Stripe connection is blocked by the reported “Missing OAuth callback data” error. No SMS, email delivery, domain, or business account configuration has been completed. Provider-backed flows and the SQL migration have not been run against a live or sandbox project. Automated tests use controlled provider doubles. This is implementation prepared for integration testing, **not a launched or independently security-audited subscription business**.

The Sites authentication path currently documented is ChatGPT sign-in. This implementation is a separate, portable Node server for the user's GitHub deployment, not an unsupported app-owned authentication scaffold on Sites. Deploy it to a Node/container host with HTTPS. GitHub stores the code; GitHub Pages continues to serve only the demo.

## Product decisions implemented

- US$15 each month, plus applicable tax. One plan includes 45 project briefs: 15 at each of three difficulties, with five studies per calculation family per level. No promises of CAD/FEA, live AI, cloud project storage, unlimited categories, or engineering certification.
- Verified email code first, verified phone second. Later sign-ins use the verified email code; the linked phone remains mandatory. This is **not** two-factor SMS on every sign-in.
- A phone is normalized to E.164 and HMAC-hashed with a server secret. A unique database constraint grants that number to one account, even under simultaneous requests. Multiple unverified Auth records cannot unlock separate Specly accounts with one number. A phone limit does not prove one human, and people may own multiple numbers.
- Checkout requires a card and affirmative recurring-payment consent. The first completed eligible Checkout starts a three-day trial; registration alone does not start it. Stripe determines the precise end timestamp. The account screen shows it in local time.
- One trial per account/claimed phone. Cancellation and signing in again do not reset it. A returning former member subscribes without another free trial.
- Access is allowed only during an unexpired `trialing` subscription, or an `active` subscription with a paid latest invoice and unexpired paid period for the configured price. Past-due, unpaid, paused, incomplete, expired or canceled subscriptions fail closed. Period-end cancellation retains access until the provider ends that period.
- Stripe is authoritative on every protected request. A success query string or browser storage cannot grant access. Webhook retries and out-of-order events never restore entitlement.
- Account billing allows card updates, invoices and cancellation through Stripe's hosted portal. No support conversation is required to cancel.
- Project files remain device-local and are separated by account ID. Existing demo projects remain in the demo namespace; export/import to transfer. Downloaded files remain usable after cancellation. Like any delivered browser code, a subscriber can retain code they already received; this is access control, not DRM.

## 1. Connect accounts and settle business details

Use a business-owned Stripe account and Supabase project. Connect the available Stripe and Supabase integrations to allow configuration assistance. Confirmed: business country USA and support email aishudigitalworks@gmail.com. Still needed: legal seller name, initial customer countries, chosen domain, and intended refund policy. Do not put secret keys in chat, public source, or the frontend.

Verify Stripe's business identity/bank requirements in its dashboard. Confirm this is USD pricing. Establish a monitored support inbox and a process for billing complaints, account recovery and deletion requests. Decide whether under-18 customers are supported; review the applicable consent requirements before accepting them.

## 2. Supabase identity and database

1. Create separate test and production projects. Apply `migrations/001_subscriptions.sql` once. All six application tables have RLS enabled with no browser policies; only the server service role can access them. Functions are executable only by the service role. Keep Auth email confirmation and phone verification enabled.
2. Configure **custom SMTP** with a verified sending domain. The default Supabase sender is unsuitable for a public launch. Set SPF/DKIM/DMARC following the email provider's documentation. In both relevant email templates (Confirm signup and Magic link), show `{{ .Token }}` as the code. This UI uses codes, not link callbacks. Example message: “Your Specly sign-in code is {{ .Token }}. If you didn't request it, you can ignore this email.” Keep the provider's expiration consistent with the wording.
3. Enable phone authentication and configure a supported SMS provider such as Twilio. Configure permitted destination countries, spend alerts, fraud protection, and the provider's required sender registrations. Use provider-approved test numbers in development. The app uses `updateUser({phone})`, then `verifyOtp({type:'phone_change'})` to attach a verified phone to the **same** email identity; it does not create a separate phone login.
4. Enable Turnstile CAPTCHA in Supabase, configure its server secret there, and put its public site key in `TURNSTILE_SITE_KEY`. Add the production hostname to Turnstile. The app passes the token to Supabase for verification on email signup. SMS sends require an email-authenticated session, plus database-backed user/phone/IP limits. Also set provider-level limits because public Supabase auth endpoints exist outside this app.
5. Set the Auth site URL and redirect allowlist to the actual HTTPS origin. Review session lifetimes and OTP limits. Test email and SMS delivery to your intended customer countries.
6. Enter `SUPABASE_URL`, anon key and service role key only in the server's environment. Never expose the service role key in a Pages workflow artifact.

## 3. Stripe configuration

1. In sandbox mode create **Specly Studio**, recurring **US$15.00 / month**, licensed pricing. Copy its price ID. The server rejects a price with a different currency, amount or interval at startup. Use a new price ID if the offer changes, and explicitly migrate the entitlement policy for existing subscriptions.
2. Set Stripe business support details, public legal terms/privacy URLs and recognizable `SPECLY` statement descriptor. Checkout collects terms consent; the API requires the matching configured terms version and records the offer. The app never handles card data.
3. Create a customer portal configuration. Enable subscription cancellation (period-end is the intended policy), invoice history and payment-method updates. Disable plan switching and quantity changes for this one-plan release. Set its return URL to `/commerce.html`. Put its configuration ID in `STRIPE_PORTAL_CONFIG_ID`.
4. Enable Stripe's trial-end email reminders, successful payment receipts, failed payment notices and the desired renewal notices. Set the cancellation link to the account page, where users can open the portal. **For trials shorter than seven days, Stripe sends its standard reminder at trial start, not one day before expiry.** If you need a separate 24-hour reminder, configure and test an additional transactional delivery job before promising that timing. It is not implemented here.
5. Register `https://YOUR_DOMAIN/api/stripe/webhook`. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`, and `invoice.payment_failed`. Store its signing secret on the server. The handler validates the raw-body signature and billing mode before processing. It stores event IDs/types, not full payment payloads. Reminder delivery comes from Stripe dashboard settings, not this webhook handler.
6. Decide sales-tax/VAT treatment for the business and launch regions. Set `STRIPE_AUTOMATIC_TAX` explicitly; enabling the flag is not a tax registration. Checkout collects billing address and updates Stripe's customer address. Review tax registrations and displayed tax treatment before enabling live sales.
7. Keep sandbox and production prices, portal configurations, webhook secrets and API keys separate. Sandbox reminders are not actually sent by Stripe, so delivery must be separately checked before launch.

## 4. Hosting the subscription version from GitHub

1. Push this complete repository to your private or public GitHub repository, with secrets excluded. A public repository intentionally shares the implementation; paid access is for the hosted service.
2. Connect a Node 22.13+ host or build the included Dockerfile. Build: `npm ci --omit=dev`. Start: `npm start` (or the Docker CMD). Host **one Node instance** initially because session-refresh serialization is process-local. Persistent sessions, accounts and rate limits live in Supabase, not the container disk. Introduce a distributed refresh lock before horizontal scaling.
3. Use a custom HTTPS domain. Configure `APP_ORIGIN` with exactly that origin, and `TRUST_PROXY_HOPS` with the host's actual proxy count; a wrong value affects IP abuse controls. Configure environment variables from `.env.example` in the host's secret settings. The application refuses to start with missing requirements.
4. Generate independent cryptographically random keys for `SESSION_ENCRYPTION_KEY` (32 bytes represented by 64 hex characters) and `PHONE_HASH_KEY` (at least 32 random characters). Preserve these in a secret manager. Losing the encryption key invalidates sessions; changing the phone key without a planned migration breaks duplicate-phone recognition.
5. The app serves a strict public file allowlist; studio JS assets and `/api/verify` require a verified, entitled account. Do not add a reverse-proxy static rule that serves `studio/app.js` or `studio/engine.js` directly. Do not configure a CDN to cache protected responses. Cookies are HTTP-only, Secure on HTTPS, SameSite=Lax, and host-scoped. Mutating routes check the Origin header. Billing webhooks use signature validation instead.
6. Publish completed policies and configure their HTTPS URLs. Set `TERMS_VERSION` to the reviewed policy revision. Complete the flags in `.env.example` only after testing. `LAUNCH_READY`, `EMAIL_SMS_READY`, `BILLING_EMAILS_READY` and `POLICIES_REVIEWED` are human attestations, not automatic verification.
7. Add uptime/error monitoring, provider budget alerts and database backups. `/healthz` reports process availability only. Monitor Stripe delivery failures and Supabase auth errors separately. Logs deliberately omit PII, tokens and request bodies.

## 5. Required sandbox acceptance tests

Run `npm ci`, `npm run check`, `npm test`. Then test real integrations against **sandbox** accounts; the automated suite cannot replace these:

- New email → code → verified phone → same user identity → Checkout; expired/incorrect codes reject; resend limits operate; CAPTCHA rejects bots.
- Two email identities simultaneously claiming the same normalized number: only one Specly account succeeds. No trial or studio access before both verifications.
- First checkout requires affirmative terms and a card, displays the correct price, starts a real three-day trial and shows its exact end. Reloading/another device cannot reset it.
- Repeated checkout clicks/network retries return one session/subscription. Abandoned or expired sessions can be resumed/replaced without duplicate billing. Cancel a trial, then resubscribe: no new trial.
- Invalid webhook signatures reject; duplicate and older events never restore revoked access. A forged `?checkout=success` does not grant access.
- Use Stripe test clocks / test subscription lifecycle controls to reach trial end and test successful payment, failed payment, recovery, period-end cancellation and immediate cancellation. Confirm protected assets and verification API fail when access ends.
- Portal cancellation works on mobile without contacting support; card update and invoice download work. Confirm refund handling and actual customer emails in the appropriate environment.
- Signed-out users cannot fetch `/app.js`, `/engine.js` or `/api/verify`. Cross-origin mutations reject. Changing local storage does not unlock backend access. A different account on a shared device sees its own project namespace.
- Confirm email/SMS deliverability, legal text, billing identity, support inbox and retention/deletion procedures. Check keyboard navigation, small screens and screen readers in the final hosted deployment.

## Operations and recovery

Phone numbers are sometimes reassigned. Do not promise “one human forever,” and do not automatically transfer an account to a new holder of a number. Recovery requires proof of the original email and a support review; changing the phone requires verifying the new number and transactionally updating its claim while preserving `trial_used`. Never grant a new trial merely to solve recovery. Keep a documented reassigned-number exception process with an audit trail.

Deletion: cancel any paid subscription first with the customer's requested effective date, export data on request, remove encrypted sessions, remove profile/Auth data according to the published policy, and apply the approved retention/anonymization rules to billing consents and the phone claim. The schema deliberately prevents deleting an Auth user while an account record still refers to it. **Do not delete random records to bypass a duplicate-number complaint.** A phone HMAC is pseudonymous personal data, not anonymous data; do not promise indefinite retention without a lawful, disclosed policy. The support inbox is the initial deletion-request channel; there is no automated deletion endpoint in this release.

Run scheduled cleanup of expired `specly_sessions` and `specly_rate_limits`. Choose retention periods for billing events, consents and phone claims based on the actual policy/obligations. Maintain backups and test restore. Review the service's fixed access policy before offering grace periods or refund-related access adjustments.

## What needs your decision before launch

Legal seller name, business country, launch countries, support email/domain, refund terms, age policy, retention periods, tax setup, provider accounts/billing, and the final live integration test. Policy outlines are in `docs/POLICY_OUTLINES.md`; they are drafting aids, not published legal terms or a guarantee of compliance.

## Official implementation references

- https://docs.stripe.com/payments/checkout/free-trials
- https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance
- https://docs.stripe.com/customer-management
- https://docs.stripe.com/webhooks
- https://supabase.com/docs/guides/auth/phone-login
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-captcha

## Pricing judgment

$15/month is a plausible experiment, not validated willingness to pay. The existing three families may have limited repeat use. Track completed first projects, trial-to-paid conversion, voluntary churn and repeat projects before promising new content or setting a long-term price. A three-day trial is implemented as requested; a longer trial may suit engineering projects better, but would be a separate product decision.


## Limited sample update
Public previews now offer exactly three fixed projects: beginner structural support, intermediate vibration isolation, and advanced thermal plate. Each permits only three preset design choices. No storage, imports, exports, reports or revision history are exposed. The full studio source lives outside dist/ and is served by the Node application only after server-side entitlement checks. Saving and exporting in the member studio recheck account access. Stripe can be configured later directly through its dashboard and server environment variables, without the ChatGPT Stripe connection; use the setup steps above.

## Member library access
After hosted Stripe checkout, the account screen confirms the current subscription with Stripe. An active trial or paid subscription unlocks Open studio; returning entitled users load the member studio automatically. No URL parameter or browser flag grants access to the protected scripts. The library includes 45 briefs with stable IDs, distinct scenarios and numerical envelopes, preserved in imports and server verification. The public site remains exactly three limited samples. Connecting Stripe through ChatGPT is optional: the owner can configure Stripe in its dashboard and set server environment values manually later.
