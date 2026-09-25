# Specly v3 authentication redirect fix

The passwordless sign-in flow now always requests this production redirect:

`https://GuptaAishani.github.io/Specly/commerce.html`

This prevents a local preview (`http://localhost:3000`) from being embedded as the post-login destination.

You must also configure the same production URLs in Supabase:
- Site URL: `https://GuptaAishani.github.io/Specly/`
- Additional Redirect URL: `https://GuptaAishani.github.io/Specly/commerce.html`

After changing Supabase settings, request a NEW sign-in email. Previously generated magic links keep their old redirect behavior and may also already be one-time-used.
