-- 0002 — recipe imports, a pantry that knows what it holds, receipt history.

-- ── recipes: imported and seeded sources ────────────────────────────────────

alter table recipes drop constraint if exists recipes_source_check;
alter table recipes add constraint recipes_source_check check (
  source in ('themealdb', 'curated', 'user', 'import', 'wikibooks', 'usda', 'gutenberg')
);

alter table recipes add column if not exists import_domain text;
alter table recipes add column if not exists fingerprint   text;
alter table recipes add column if not exists yield_text    text;

create index if not exists recipes_fingerprint_idx on recipes (fingerprint)
  where fingerprint is not null;

-- Package sizes: "2 (14 oz) cans" is two cans, and each is fourteen ounces.
alter table recipe_ingredients add column if not exists pack_size_qty  numeric;
alter table recipe_ingredients add column if not exists pack_size_unit text;
alter table recipe_ingredients add column if not exists alt_item       text;

create table if not exists recipe_imports (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  url          text not null,
  url_hash     text not null,
  domain       text,
  recipe_id    uuid references recipes (id) on delete set null,
  strategy     text,
  status       text not null default 'ok' check (status in ('ok', 'failed')),
  error        text,
  imported_by  uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (household_id, url_hash)
);

create index if not exists recipe_imports_household_idx
  on recipe_imports (household_id, created_at desc);

alter table recipe_imports enable row level security;

drop policy if exists imports_all on recipe_imports;
create policy imports_all on recipe_imports for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

-- ── pantry: have / low / out, and how much ──────────────────────────────────

alter table pantry_items add column if not exists aisle           text not null default 'other';
alter table pantry_items add column if not exists kind            text not null default 'staple';
alter table pantry_items add column if not exists status          text not null default 'have';
alter table pantry_items add column if not exists quantity        numeric;
alter table pantry_items add column if not exists unit            text;
alter table pantry_items add column if not exists updated_at      timestamptz not null default now();
alter table pantry_items add column if not exists last_used_at    timestamptz;
alter table pantry_items add column if not exists used_since_buy  int not null default 0;
alter table pantry_items add column if not exists added_by        uuid references profiles (id) on delete set null;

alter table pantry_items drop constraint if exists pantry_items_kind_check;
alter table pantry_items add constraint pantry_items_kind_check
  check (kind in ('staple', 'stock'));

alter table pantry_items drop constraint if exists pantry_items_status_check;
alter table pantry_items add constraint pantry_items_status_check
  check (status in ('have', 'low', 'out'));

create index if not exists pantry_items_status_idx
  on pantry_items (household_id, status);

-- ── grocery list: a row can now come from the cupboard running dry ──────────

alter table grocery_items drop constraint if exists grocery_items_source_check;
alter table grocery_items add constraint grocery_items_source_check check (
  source in ('plan', 'manual', 'receipt', 'pantry')
);

alter table grocery_items add column if not exists note text;

-- ── receipts: what it came to, and finding them again ───────────────────────

alter table receipts add column if not exists total    numeric;
alter table receipts add column if not exists currency text not null default 'USD';

create index if not exists receipts_household_idx
  on receipts (household_id, created_at desc);

-- ── realtime ────────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table pantry_items;
exception
  when duplicate_object then null;
end
$$;
