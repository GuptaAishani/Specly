# Specly v5 sign-in UX update

- Removed the automatic resend countdown.
- A successful send now shows `Email sent ✓`.
- After a brief visual confirmation, the button becomes `Send another sign-in link →`.
- Users can request another sign-in email whenever they choose.
- If Supabase itself rate-limits repeated sends, the site shows a short error and immediately re-enables the button; there is no client-side lockout or countdown.
