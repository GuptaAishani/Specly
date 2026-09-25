# Specly v2 launch-copy update

This version removes public-facing “demo” and “trial” branding.

Public pricing now reads:
- First 3 days free
- Then US$15/month plus applicable tax
- Automatically renews until canceled

The site also emphasizes that:
- new projects are added consistently
- personalized project briefs are coming soon

The Stripe/Supabase backend still uses Stripe's internal `trialing` subscription status and `trial_end` fields where required. Those internal names are not public-facing branding and must remain for correct subscription handling.
