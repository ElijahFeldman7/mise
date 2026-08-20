# mise

Plan the week, write the list, cross it off at the store.

A mobile-first meal planner and shared grocery list for a household. Next.js 16,
Supabase, Google sign-in. The visual language is lifted from
[tjbo.org](https://tjbo.org): warm paper, one accent, hairline rules, headings
underlined in the accent — no shadows, nothing in capitals, letter-spacing that
only ever tightens.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` already holds the Supabase project URL and publishable key. The app
needs nothing else — every permission is enforced by row-level security, so
there is no service-role key sitting in the running application.

## Filling the recipe library

The seeder is the one thing that needs the secret key, and it only ever runs on
your machine:

```bash
# add to .env.local, from Supabase → Settings → API Keys → Secret keys
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

npm run seed                    # ~300 recipes from TheMealDB + 18 hand-written
npm run seed -- --letters=abc   # a smaller run while you're poking at it
```

Everything is normalised through `lib/ingredients.ts` on the way in, so a
library recipe and one you typed yourself merge onto the same grocery line.

## How it fits together

```
app/
  signin/                sign in with Google, nothing else
  (app)/
    week/                the seven days, and "fill the gaps"
    day/[date]/          slots, servings, and what to cook tonight
    recipes/             browse, search, write, fork, photograph
    list/                the grocery list
    list/scan/           receipt OCR, on the device
    household/           who's in it, and the invite code
    you/                 diet, banned ingredients, weeknight time budget
    admin/               every user, and who's an admin
  api/
    recommend/           scores candidates for one slot
    plan/fill/           fills a whole week of empty dinners

lib/
  ingredients.ts         the heart of it — item_key, aisles, diet flags
  units.ts               parsing measures, and adding two of them up
  groceries.ts           plan → shopping list, and the diff that keeps ticks
  recommend.ts           the six-signal scorer
  ocr.ts                 receipt lines → grocery rows
  images.ts              on-device compression, before anything uploads

supabase/migrations/     the schema, already applied
```

## The pieces worth knowing about

**`item_key` is the join.** Every ingredient, grocery row and receipt line is
reduced to a canonical key — "finely chopped fresh coriander" and "cilantro"
both become `cilantro`. Merging, matching, "have it" badges and the pantry all
key off it. If something behaves oddly, that function is where to look.

**The grocery list is a diff, not a rebuild.** Editing the plan regenerates only
plan-sourced rows. Hand-added items survive, and a row you already ticked off is
never removed or un-ticked — you bought the thing; changing your mind about
Thursday doesn't un-buy it.

**Recommendations explain themselves.** Six signals — pantry overlap, household
taste, variety, effort fit, seasonality, novelty — each normalised to 0–1 and
weighted. Whichever one is furthest above its baseline writes the sentence under
the recipe name. With no history, the taste model's weight is handed to overlap
instead, so a brand-new household still gets sensible answers.

**Receipts never leave the phone.** Tesseract runs in a web worker on the
device. Only the extracted text and the matches you confirm reach the database.
Matches above 0.72 tick themselves; between 0.44 and 0.72 the app asks.

**Admin is a database flag, not a separate app.** `profiles.is_admin` gates the
tab, and a trigger stops anyone from granting it to themselves — only an
existing admin can move that bit.
