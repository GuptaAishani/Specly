# Policy drafting inputs — not for publication as-is

Complete these with the seller's actual jurisdiction and operations, and review the applicable requirements before enabling live sales. The server requires real HTTPS policy URLs and an owner review flag; this file is not a legal opinion or finished policy.

## Terms and subscription agreement

- Seller's legal name, business address/contact and eligible customer regions/ages.
- Accurate service scope: educational template-generated engineering briefs and analytical design studies; no professional certification, CAD/FEA, real customer RFPs or currently integrated generative AI.
- US$15/month in USD plus applicable tax; a three-day trial for eligible first-time users begins after completed card checkout; automatic monthly renewal unless canceled before the next charge. Account page displays the precise trial end time.
- Affirmative consent and accessible subscription terms at checkout; one trial per account and verified phone number, with support recovery for reassigned numbers.
- How to cancel through Account & billing → Manage billing; effective date, paid-period access and any refund/withdrawal rights as required by applicable law. No invented “no refunds under any circumstances” language.
- Customer ownership/use of their project reports, service/IP permissions, acceptable use, service changes and availability, liability terms appropriate to jurisdiction and educational use, dispute process and governing law.
- How users contact support, request deletion or handle a phone-number change.

## Privacy notice

- Legal data controller/contact and applicable rights.
- Data actually processed: email, verified phone via Supabase/SMS provider, a keyed phone fingerprint on Specly's database, account identifier, encrypted session credentials, Stripe customer/subscription references, consent records and minimal webhook event metadata. Stripe handles card data. Projects remain on-device; verification API receives mission/design parameters to run checks and does not save them in this release.
- Purpose/legal basis: identity, duplicate-account/trial limits, service delivery, fraud control, payments, customer support and obligations. Do not repurpose phone verification consent for marketing.
- Processors: actual hosting provider, Supabase, configured SMTP/SMS providers, Stripe and Turnstile/Cloudflare. Google Fonts is used by the frontend. State actual international-transfer safeguards where needed.
- Authentication cookie and local project storage, retention periods, phone-fingerprint treatment, backups, deletion requests, recovery exceptions and payment record retention.
- Rights/request process, response timeframes applicable to the seller, children's data, security practices without absolute guarantees, change notification and effective date.

## Refund and cancellation policy

- Trial cancellation cutoff and exact navigation to cancel online.
- Whether paid subscriptions cancel immediately or at period end; align Stripe portal configuration and visible text.
- Seller's chosen refund policy, refund request process, duplicate/erroneous charge handling and statutory exceptions. Decide whether/how prorating is offered; no prorating feature is implemented by this app.
- Failed payment behavior: this release denies new studio access once Stripe reports the configured access conditions are no longer met.
- Cancellation does not delete files already downloaded; support process for personal-data deletion is separate.

## SMS disclosure

“We’ll text a verification code. Message and data rates may apply. This does not opt you into marketing texts.” Review additional country/provider-required wording and sender registrations. Set up separate consent if marketing texts are ever added; none are implemented.
