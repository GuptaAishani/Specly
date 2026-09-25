# Historical note

Google sign-in described in this V8 file has been removed in V9. See `V9_EMAIL_PASSWORD_ONLY.md` for the current authentication setup.

# Specly V8 — Account login setup

V8 replaces the old magic-link-only member sign-in with a normal account experience:

- Email + password sign in
- Create account with email + password
- Forgot password / password recovery
- Google sign in button
- Persistent Supabase browser session
- Existing active members return directly to the member studio
- Signed-in users without a membership go to checkout
- Existing magic-link users can add a password without creating a second account

## 1. Supabase redirect URL

Go to **Supabase → Authentication → URL Configuration**.

Set / keep:

- **Site URL**: `https://GuptaAishani.github.io/Specly/`
- **Redirect URL**: `https://GuptaAishani.github.io/Specly/login.html`
- You can keep the existing `https://GuptaAishani.github.io/Specly/commerce.html` redirect too.

The `login.html` redirect is required for password recovery, email confirmation, and Google OAuth.

## 2. Email + password

Supabase's Email provider handles both password and email-link auth. Since Specly already uses Supabase email auth, the frontend is ready for password sign in.

For the account you already created with the old magic-link flow:

- While still signed in, open **Account & billing → Sign-in settings** and set a password, or
- If signed out, open **Sign in → Forgot password**. The recovery email lets you create a password for the existing account.

Do not create a second account with the same email just to add a password.

## 3. Google sign in

The Google button is implemented in `login.js`, but it will not work until the Google provider is enabled in Supabase.

### Google Cloud

1. Open Google Cloud / Google Auth Platform.
2. Create or choose a project for Specly.
3. Configure **Branding**, **Audience**, and **Data Access**.
4. Under Data Access, use the basic scopes required for sign in: `openid`, email, and profile.
5. Create an OAuth client and choose **Web application**.
6. Under **Authorized JavaScript origins**, add:
   - `https://guptaaishani.github.io`
7. Under **Authorized redirect URIs**, add:
   - `https://mpseexgimmtdfqtirohj.supabase.co/auth/v1/callback`
8. Copy the Google **Client ID** and **Client Secret**.

### Supabase

1. Go to **Authentication → Providers → Google**.
2. Turn Google on.
3. Paste the Google Client ID and Client Secret.
4. Save.
5. Do not share the Client Secret in chat or put it in GitHub.

## 4. Test the returning-member flow

1. Open `login.html`.
2. Sign in with your existing member email and password.
3. Because your Supabase subscription is `trialing` or `active`, Specly should go directly to the member studio.
4. Close the tab completely.
5. Reopen Specly. The browser session should normally remain signed in and the member studio should load automatically.
6. Sign out from Account & billing.
7. Sign back in from `login.html`; there should be no second Stripe checkout.

## 5. Project library

The V7 difficulty filter remains in V8. Member projects are grouped with a single dropdown:

- Easy — 15
- Medium — 15
- Hard — 15

Only the selected difficulty is shown at one time.
