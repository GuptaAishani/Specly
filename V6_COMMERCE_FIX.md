# Specly v6 commerce fix

The v5 sign-in edit accidentally removed several existing helper/render functions from `commerce.js`,
including `renderSignedOut`, which caused the runtime error:

`renderSignedOut is not defined`

v6 restores the complete commerce flow and keeps the requested sign-in UX:
- button shows `Sending…`
- success shows `Email sent ✓`
- after ~2 seconds it becomes `Send another sign-in link →`
- no client-side countdown
- users can request another sign-in link whenever they want
- Supabase may still enforce its own server-side anti-spam rate limit
