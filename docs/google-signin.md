# Turning on Google sign-in

Everything else is done. This is the last piece, and it needs a Google OAuth
client that only you can create — Google shows the client secret once, and it
has to be pasted by hand.

Budget about five minutes.

---

## 1. Make a Google Cloud project

Go to **https://console.cloud.google.com/projectcreate**

- **Project name**: `mise`
- Leave the organisation as-is
- **Create**, then wait for the notification and make sure `mise` is the project
  selected in the bar at the top

## 2. Set up the consent screen

Go to **https://console.cloud.google.com/auth/overview** and click
**Get started**.

- **App name**: `mise`
- **User support email**: your gmail
- **Audience**: **External**
- **Contact information**: your gmail
- Agree to the policy, **Create**

## 3. Add the scopes it actually needs

Left sidebar → **Data access** → **Add or remove scopes**. Tick these three and
nothing else:

```
openid
.../auth/userinfo.email
.../auth/userinfo.profile
```

**Update**, then **Save**.

## 4. Add yourself as a test user

Left sidebar → **Audience** → under **Test users**, **Add users** → your gmail.

While the app is in Testing, only listed test users can sign in. Add anyone in
the household you want to try it. (Publishing the app removes that limit but
sends you into Google's verification flow — not worth it for a family app.)

## 5. Create the OAuth client

Left sidebar → **Clients** → **Create client**.

- **Application type**: **Web application**
- **Name**: `mise web`

**Authorised JavaScript origins** — add both:

```
https://mise.elijahwfeldman.com
http://localhost:3000
```

**Authorised redirect URIs** — add exactly this, it is your Supabase project's
auth callback and a typo here is the single most common way this goes wrong:

```
https://fqnitrkgvuzpfobyjbgz.supabase.co/auth/v1/callback
```

**Create**. A panel appears with **Client ID** and **Client secret**. Leave it
open, or copy both somewhere for the next step.

## 6. Paste them into Supabase

Go to **https://supabase.com/dashboard/project/fqnitrkgvuzpfobyjbgz/auth/providers**

Find **Google**, expand it, and:

- Toggle **Enable Sign in with Google** on
- **Client IDs**: paste the client ID
- **Client Secret (for OAuth)**: paste the secret
- **Save**

---

## Then

Live: **https://mise.elijahwfeldman.com**. Locally, `npm run dev`.

Hit **Continue with Google**, pick your account.

`Unsupported provider: provider is not enabled` is what you get until step 6 is
done — it comes from Supabase, not from the app, and it means exactly what it
says.

On that first sign-in the database does four things by itself: makes your
profile, makes a household called "Eli's kitchen", makes you its owner, and
gives you Breakfast / Lunch / Dinner slots to start from. It also sets
`is_admin` to true, because the trigger matches on `elifeldman769@gmail.com` —
so the Admin tab will be there when you land.

## If something goes wrong

**`redirect_uri_mismatch`** — the URI in step 5 doesn't match byte for byte.
Check for a trailing slash, `http` instead of `https`, or a mistyped project ref.

**"Access blocked: mise has not completed the Google verification process"** —
you're not in the test users list from step 4.

**Signs in, then bounces back to `/signin`** — the redirect URL allow list. It
should already have `http://localhost:3000/**`, at
Authentication → URL Configuration.

**Signs in but the app says it can't find your household** — the
`handle_new_user` trigger didn't fire. Check
`select * from auth.users` and `select * from profiles` in the SQL editor; if
there's a user with no profile, re-run the bottom half of
`supabase/migrations/0001_init.sql` and delete that user so it can be recreated.

## Already done on the Supabase side

- **Site URL**: `https://mise.elijahwfeldman.com`
- **Redirect URLs**: `https://mise.elijahwfeldman.com/**` and `http://localhost:3000/**`

The Google redirect URI never changes with your domain — it always points at
Supabase.

## One env var on the host

Set this wherever the app is deployed, so link previews and canonical URLs point
at the real domain instead of localhost:

```
NEXT_PUBLIC_SITE_URL=https://mise.elijahwfeldman.com
```

Nothing breaks without it; the Open Graph image just resolves against
`localhost:3000`.
