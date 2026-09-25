# Specly v4 sign-in UX update

- Successful email sends now visibly change the button to `Email sent ✓`.
- The button counts down before allowing another send.
- After the cooldown it becomes `Resend sign-in link →`.
- Supabase rate-limit responses are translated into a friendly message instead of looking like a broken signup.
- Users can always sign in again later using the same email; the short cooldown only prevents repeated email sends within about a minute.
