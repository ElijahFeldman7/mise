-- ============================================================================
-- mise — schema
-- Meal planning, shared grocery lists, receipt reconciliation.
-- Everything is scoped to a household; a person always has exactly one active
-- household (created for them on first sign-in) and may belong to several.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------

create table if not exists households (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My household',
  invite_code   text not null unique,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  display_name         text,
  avatar_url           text,
  is_admin             boolean not null default false,
  active_household_id  uuid references households (id) on delete set null,

  -- taste profile, feeds the recommender
  diet_tags            text[] not null default '{}',   -- vegetarian, vegan, gluten_free, dairy_free, pork_free, nut_free
  avoid_ingredients    text[] not null default '{}',   -- item_keys the recommender must never surface
  liked_cuisines       text[] not null default '{}',
  weeknight_max_minutes int   not null default 45,

  created_at           timestamptz not null default now(),
  last_seen_at         timestamptz
);

alter table households
  add constraint households_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

create table if not exists household_members (
  household_id uuid not null references households (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  nickname     text,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx on household_members (user_id);

-- ---------------------------------------------------------------------------
-- Recipes
--
-- A recipe is either LIBRARY (owner_id is null, is_public true) or PERSONAL
-- (owned by a household). "Make it mine" copies a library row into the
-- household and records forked_from.
-- ---------------------------------------------------------------------------

create table if not exists recipes (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,

  source         text not null default 'user' check (source in ('themealdb', 'curated', 'user')),
  source_id      text,
  source_url     text,
  image_url      text,          -- remote image (library recipes)
  image_path     text,          -- storage object path (user photos)

  instructions   text[] not null default '{}',
  total_minutes  int,
  active_minutes int,
  servings       int not null default 4,
  oven_temp_f    int,          -- shown on the recipe when there is one

  cuisine        text,
  category       text,          -- breakfast | lunch | dinner | side | dessert | snack | prep
  tags           text[] not null default '{}',
  diet_flags     text[] not null default '{}',
  effort         smallint not null default 2 check (effort between 1 and 3),

  is_public      boolean not null default false,
  owner_id       uuid references profiles (id) on delete set null,
  household_id   uuid references households (id) on delete cascade,
  forked_from    uuid references recipes (id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint recipes_ownership check (
    (is_public and household_id is null) or (not is_public and household_id is not null)
  )
);

create index if not exists recipes_household_idx on recipes (household_id);
create index if not exists recipes_public_idx on recipes (is_public) where is_public;
create index if not exists recipes_title_trgm on recipes using gin (title gin_trgm_ops);
create index if not exists recipes_tags_idx on recipes using gin (tags);
create unique index if not exists recipes_source_unique on recipes (source, source_id)
  where source_id is not null and is_public;

create table if not exists recipe_ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes (id) on delete cascade,
  position   int not null default 0,

  raw_text   text,                -- "2 lb Yukon gold potatoes, halved"
  quantity   numeric,             -- 2
  unit       text,                -- lb   (normalized token, null = count)
  item       text not null,       -- "Yukon gold potatoes"
  item_key   text not null,       -- "potato"  — what merging and matching use
  note       text,                -- "halved"
  aisle      text not null default 'other',
  optional   boolean not null default false
);

create index if not exists recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);
create index if not exists recipe_ingredients_key_idx on recipe_ingredients (item_key);

-- Photos of the finished dish, taken by whoever cooked it. Compressed on the
-- phone before upload, so what lands here is already a web-sized JPEG.
create table if not exists recipe_photos (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references recipes (id) on delete cascade,
  household_id uuid references households (id) on delete cascade,
  taken_by     uuid references profiles (id) on delete set null,
  storage_path text not null,
  width        int,
  height       int,
  bytes        int,
  caption      text,
  taken_at     timestamptz not null default now()
);

create index if not exists recipe_photos_recipe_idx on recipe_photos (recipe_id, taken_at desc);

-- ---------------------------------------------------------------------------
-- The week
--
-- Slots are not an enum. A plan entry carries its own label and time, so a
-- household can invent "second breakfast" or "Sunday prep, 4pm" freely.
-- slot_templates just seeds the picker.
-- ---------------------------------------------------------------------------

create table if not exists slot_templates (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name         text not null,
  at_time      time,
  position     int not null default 0
);

create table if not exists plan_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  on_date      date not null,
  slot_label   text not null,
  slot_time    time,
  position     int not null default 0,

  recipe_id    uuid references recipes (id) on delete set null,
  free_text    text,                    -- when there is no recipe: "leftovers"
  servings     int not null default 2,
  note         text,

  cooked_at    timestamptz,
  created_by   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint plan_entries_has_content check (recipe_id is not null or free_text is not null)
);

create index if not exists plan_entries_household_date_idx on plan_entries (household_id, on_date);

-- ---------------------------------------------------------------------------
-- Grocery list
--
-- One list per household per week. Rows sourced from the plan are regenerated
-- on every plan change; manual rows and every checkbox survive that.
-- ---------------------------------------------------------------------------

create table if not exists grocery_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  week_start   date not null,
  created_at   timestamptz not null default now(),
  unique (household_id, week_start)
);

create table if not exists grocery_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references grocery_lists (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,

  item         text not null,
  item_key     text not null,
  quantity     numeric,
  unit         text,
  display_qty  text,          -- "2 lb + 1 bunch" when two recipes disagree on units
  aisle        text not null default 'other',

  checked      boolean not null default false,
  checked_at   timestamptz,
  checked_by   uuid references profiles (id) on delete set null,
  checked_via  text check (checked_via in ('tap', 'receipt')),

  source       text not null default 'plan' check (source in ('plan', 'manual', 'receipt')),
  from_recipes text[] not null default '{}',   -- titles, for the little provenance chip
  added_by     uuid references profiles (id) on delete set null,
  position     int not null default 0,
  created_at   timestamptz not null default now(),

  unique (list_id, item_key, source)
);

create index if not exists grocery_items_list_idx on grocery_items (list_id);

-- Things the household always has. Kept off the list, and counted as
-- "in the kitchen" when scoring a recipe.
create table if not exists pantry_items (
  household_id uuid not null references households (id) on delete cascade,
  item_key     text not null,
  item         text not null,
  primary key (household_id, item_key)
);

-- ---------------------------------------------------------------------------
-- Receipts
-- OCR happens on the phone; only the extracted text and the matches land here.
-- The photo is optional and private to the household.
-- ---------------------------------------------------------------------------

create table if not exists receipts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households (id) on delete cascade,
  uploaded_by   uuid references profiles (id) on delete set null,
  image_path    text,
  store         text,
  purchased_on  date,
  raw_text      text,
  line_count    int not null default 0,
  matched_count int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists receipt_lines (
  id              uuid primary key default gen_random_uuid(),
  receipt_id      uuid not null references receipts (id) on delete cascade,
  raw_line        text not null,
  parsed_name     text,
  price           numeric,
  matched_item_id uuid references grocery_items (id) on delete set null,
  confidence      numeric,
  status          text not null default 'unmatched'
                  check (status in ('auto', 'suggested', 'confirmed', 'rejected', 'unmatched'))
);

create index if not exists receipt_lines_receipt_idx on receipt_lines (receipt_id);

-- ---------------------------------------------------------------------------
-- Signals for the recommender
-- ---------------------------------------------------------------------------

create table if not exists recipe_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id      uuid references profiles (id) on delete set null,
  recipe_id    uuid not null references recipes (id) on delete cascade,
  kind         text not null check (kind in ('planned', 'cooked', 'rated', 'skipped', 'saved', 'unsaved')),
  rating       smallint check (rating between 1 and 5),
  happened_at  timestamptz not null default now()
);

create index if not exists recipe_events_household_idx on recipe_events (household_id, happened_at desc);
create index if not exists recipe_events_recipe_idx on recipe_events (recipe_id);

-- ============================================================================
-- Helpers. SECURITY DEFINER so policies can read membership without the
-- policy on household_members recursing into itself.
-- ============================================================================

create or replace function public.my_household_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid();
$$;

create or replace function public.my_household_user_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select m.user_id
  from household_members m
  where m.household_id in (select household_id from household_members where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ============================================================================
-- Bootstrap: every new auth user gets a profile and their own household.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  new_household uuid;
  code          text;
  who           text;
begin
  who := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, email, display_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    who,
    new.raw_user_meta_data ->> 'avatar_url',
    lower(new.email) = 'elifeldman769@gmail.com'
  );

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into households (name, invite_code, created_by)
  values (who || '''s kitchen', code, new.id)
  returning id into new_household;

  insert into household_members (household_id, user_id, role)
  values (new_household, new.id, 'owner');

  insert into slot_templates (household_id, name, at_time, position) values
    (new_household, 'Breakfast', '07:30', 0),
    (new_household, 'Lunch',     '12:30', 1),
    (new_household, 'Dinner',    '18:30', 2);

  update profiles set active_household_id = new_household where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody grants themselves admin. Only an existing admin may move that bit.
create or replace function public.guard_admin_flag()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'only an admin can change is_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_admin on profiles;
create trigger profiles_guard_admin
  before update on profiles
  for each row execute function public.guard_admin_flag();

-- ============================================================================
-- Row level security
-- ============================================================================

alter table households        enable row level security;
alter table profiles          enable row level security;
alter table household_members enable row level security;
alter table recipes           enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_photos    enable row level security;
alter table slot_templates    enable row level security;
alter table plan_entries      enable row level security;
alter table grocery_lists     enable row level security;
alter table grocery_items     enable row level security;
alter table pantry_items      enable row level security;
alter table receipts          enable row level security;
alter table receipt_lines     enable row level security;
alter table recipe_events     enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_read on profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or id in (select public.my_household_user_ids())
);
create policy profiles_update_self on profiles for update using (
  id = auth.uid() or public.is_admin()
) with check (
  id = auth.uid() or public.is_admin()
);

-- households ----------------------------------------------------------------
create policy households_read on households for select using (
  id in (select public.my_household_ids()) or public.is_admin()
);
create policy households_insert on households for insert with check (created_by = auth.uid());
create policy households_update on households for update using (
  public.is_household_owner(id) or public.is_admin()
);
create policy households_delete on households for delete using (
  public.is_household_owner(id) or public.is_admin()
);

-- household_members ---------------------------------------------------------
create policy members_read on household_members for select using (
  household_id in (select public.my_household_ids()) or public.is_admin()
);
create policy members_join on household_members for insert with check (
  user_id = auth.uid() or public.is_household_owner(household_id) or public.is_admin()
);
create policy members_update on household_members for update using (
  public.is_household_owner(household_id) or public.is_admin()
);
create policy members_leave on household_members for delete using (
  user_id = auth.uid() or public.is_household_owner(household_id) or public.is_admin()
);

-- recipes -------------------------------------------------------------------
create policy recipes_read on recipes for select using (
  is_public
  or household_id in (select public.my_household_ids())
  or public.is_admin()
);
create policy recipes_write on recipes for insert with check (
  household_id in (select public.my_household_ids()) and owner_id = auth.uid()
);
create policy recipes_update on recipes for update using (
  household_id in (select public.my_household_ids()) or public.is_admin()
);
create policy recipes_delete on recipes for delete using (
  household_id in (select public.my_household_ids()) or public.is_admin()
);

create policy ingredients_read on recipe_ingredients for select using (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and (r.is_public or r.household_id in (select public.my_household_ids()) or public.is_admin())
  )
);
create policy ingredients_write on recipe_ingredients for all using (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and (r.household_id in (select public.my_household_ids()) or public.is_admin())
  )
) with check (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and (r.household_id in (select public.my_household_ids()) or public.is_admin())
  )
);

create policy recipe_photos_read on recipe_photos for select using (
  household_id in (select public.my_household_ids())
  or public.is_admin()
  or exists (select 1 from recipes r where r.id = recipe_id and r.is_public)
);
create policy recipe_photos_write on recipe_photos for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

-- everything else is plain household scoping --------------------------------
create policy slots_all on slot_templates for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

create policy plan_all on plan_entries for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

create policy lists_all on grocery_lists for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

create policy items_all on grocery_items for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

create policy pantry_all on pantry_items for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

create policy receipts_all on receipts for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

create policy receipt_lines_all on receipt_lines for all
  using (exists (
    select 1 from receipts r where r.id = receipt_id
      and (r.household_id in (select public.my_household_ids()) or public.is_admin())
  ))
  with check (exists (
    select 1 from receipts r where r.id = receipt_id
      and r.household_id in (select public.my_household_ids())
  ));

create policy events_all on recipe_events for all
  using (household_id in (select public.my_household_ids()) or public.is_admin())
  with check (household_id in (select public.my_household_ids()));

-- ============================================================================
-- Joining a household by code. SECURITY DEFINER because the joiner cannot see
-- the household row until they are already a member.
-- ============================================================================

create or replace function public.join_household(code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
begin
  select id into target from households
  where upper(replace(invite_code, '-', '')) = upper(replace(code, '-', ''));

  if target is null then
    raise exception 'That code does not match a household';
  end if;

  insert into household_members (household_id, user_id, role)
  values (target, auth.uid(), 'member')
  on conflict do nothing;

  update profiles set active_household_id = target where id = auth.uid();
  return target;
end;
$$;

-- ============================================================================
-- Realtime + storage
-- ============================================================================

alter publication supabase_realtime add table grocery_items;
alter publication supabase_realtime add table plan_entries;

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "recipe photos are readable" on storage.objects
  for select using (bucket_id = 'recipe-photos');
create policy "signed in people can add recipe photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'recipe-photos');
create policy "people can replace their own recipe photos" on storage.objects
  for update to authenticated using (bucket_id = 'recipe-photos' and owner = auth.uid());
create policy "people can remove their own recipe photos" on storage.objects
  for delete to authenticated using (bucket_id = 'recipe-photos' and owner = auth.uid());

create policy "receipts are private to whoever uploaded them" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and owner = auth.uid())
  with check (bucket_id = 'receipts' and owner = auth.uid());
