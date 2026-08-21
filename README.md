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

## The schema

`0001_init.sql` is already applied. **`0002` through `0005` are not** — run them
in the Supabase SQL editor, in order, before using anything below:

| | |
| --- | --- |
| `0002_import_pantry_receipts.sql` | the cupboard's three states, package sizes, receipt totals, the import audit table |
| `0003_portions_and_diet.sql` | the household's headcount |
| `0004_cuisine.sql` | the cuisine index and count function — and it renames "France" to "French" in the rows already there |
| `0005_dislikes.sql` | things you'd rather not eat |

## Filling the recipe library

The seeder is the one thing that needs the secret key, and it only ever runs on
your machine:

```bash
# add to .env.local, from Supabase → Settings → API Keys → Secret keys
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

npm run seed                          # every source, roughly 4,100 recipes
npm run seed -- --source=wikibooks    # one of them
npm run seed -- --limit=50 --dry-run  # read, judge, write nothing (no key needed)
npm run seed -- --no-cache            # ignore .cache/ and re-fetch
```

| Source | Recipes | Licence |
| --- | --- | --- |
| Hand-written (`data/curated-recipes.json`) | 18 | written for this app |
| TheMealDB | ~300 | free public API |
| Wikibooks Cookbook | ~3,800 | CC BY-SA 3.0 |

Every recipe keeps its `source_url`, and the recipe page links back to it — that
link is the attribution the Wikibooks licence asks for, so don't remove it.

Two more sources were planned and dropped after testing: MyPlate (USDA, public
domain) redirects scripted requests to its homepage, and Project Gutenberg's
cookbooks are flowing Victorian prose with no ingredient lists in them. Adding
either later is one file in `scripts/seed/sources/`.

Around 4% of what the sources offer never lands: fewer than two ingredients,
fewer than two steps, or more than 40% of the ingredient lines unparseable. What
was turned away, and why, is written to `data/seed-report.json` after each run —
that file is the to-do list for the parser.

```bash
npm run check:parse          # 60 real ingredient lines, expected parses
npm run check:parse -- --strict   # exit non-zero on any miss
```

Everything is normalised through `lib/ingredients.ts` on the way in, so a
library recipe, an imported one, and one you typed yourself all merge onto the
same grocery line.

## How it fits together

```
app/
  signin/                sign in with Google, nothing else
  (app)/
    week/                the seven days, and "fill the gaps"
    day/[date]/          slots, servings, and what to cook tonight
    recipes/             browse, search, write, fork, photograph
    recipes/import/      paste a link, look it over, keep it
    list/                the grocery list
    list/cupboard/       what's already at home
    list/scan/           receipt OCR, on the device
    list/receipts/       every receipt you've scanned
    household/           who's in it, and the invite code
    you/                 diet, banned ingredients, weeknight time budget
    admin/               every user, and who's an admin
  api/
    recommend/           scores candidates for one slot
    plan/fill/           fills a whole week of empty dinners

lib/
  ingredients.ts         the heart of it — item_key, aisles, diet flags
  units.ts               measures in, measures out, and the line tokenizer
  groceries.ts           plan → list, minus the cupboard, plus the diff
  pantry.ts              the starter kit and how it's searched
  recommend.ts           the six-signal scorer
  ocr.ts                 receipt lines → grocery rows, and the total
  images.ts              on-device compression, before anything uploads
  import/
    fetch.ts             a careful stranger's HTTP client
    extract.ts           JSON-LD → microdata → per-site → heuristics
    normalize.ts         schema.org shapes into ours

scripts/
  seed/                  sources, quality gate, batched upserts
  check-parse.ts         the ingredient-line fixtures

supabase/migrations/     0001 applied, 0002 waiting for you
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

**A pasted link becomes a draft, never a row.** `importRecipeFromUrl` fetches,
extracts and normalises, then hands back a draft for you to look at; only
"Save" writes anything. The fetcher re-checks DNS after every redirect, because
a public URL that bounces to `169.254.169.254` is exactly the trick worth
blocking. Imports are household-private with a link home — a normalised
ingredient list and a credit, not a republished article.

**The cupboard is three states and one tap.** have → running low → out → back to
have. "Have" with no amount means the row simply doesn't appear. "Have" with an
amount does arithmetic: need 500g of flour with 200g in the tin and the list
says 300g, and says why. Weight is never converted into volume — two tablespoons
of harissa against a jar of it stay incomparable, and it buys more. Buying
something, by tick or by receipt, fills it back up on its own.

**One number sets every portion.** The household has a headcount, set on the
household page. New meals start there, the recipe page opens at that many rather
than at whatever the writer cooked for, and the ingredient quantities rescale as
you change it — including into the week, so the grocery list is already the right
size. Per-meal adjustment still lives on the day, where it belongs.

**Diets are the union of the people, not a switch.** Each person keeps their own
tags on `/you`; `lib/server/diet.ts` folds them together, and one vegetarian
makes the house vegetarian for browsing and for recommendations. Banned
ingredients are sifted on `item_key`, so "no coriander" also catches "finely
chopped fresh cilantro". There's one quiet line under the heading to see
everything anyway — filtering is a default, never a cage.

**Cuisine is an adjective, and normalised on the way in.** TheMealDB names
places — "France", "United States" — sitting next to "Spanish" and "British",
which makes for a filter row that reads like a customs queue.
`lib/cuisines.ts` folds both forms into one, and every source runs through it.
Wikibooks publishes no cuisine field at all, so the seeder reads it out of the
page's categories instead: `Category:Thai recipes` next to `Category:Easy
recipes` means knowing which words are nationalities, which is what that file's
list is for. It also picks up the course and the difficulty the same way, which
beats guessing either from the title. Searching reaches titles, cuisines and
tags together, so "thai" finds Pad See Ew.

**Never suggest, and rather not.** Two lists on `/you`, and the difference
matters. "Never suggest" is a hard filter — a recipe with it in never appears.
"Rather not" multiplies the score down: 0.62 for each disliked ingredient, and
0.6 again if the word is in the title, so a mushroom risotto falls a long way
and a stew with one mushroom in it falls a little. Both lists are stored as
`item_key`s and unioned across the household, so one person's "no coriander"
also catches everyone's "finely chopped fresh cilantro".

**Receipts never leave the phone.** Tesseract runs in a web worker on the
device. Only the extracted text and the matches you confirm reach the database.
Matches above 0.72 tick themselves; between 0.44 and 0.72 the app asks.

**Admin is a database flag, not a separate app.** `profiles.is_admin` gates the
tab, and a trigger stops anyone from granting it to themselves — only an
existing admin can move that bit.
