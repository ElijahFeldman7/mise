-- 0004 — browsing by cuisine.

create index if not exists recipes_cuisine_idx on recipes (cuisine)
  where cuisine is not null;

-- Security invoker (the default), so row-level security still decides what
-- counts: you see cuisines from the public library and your own shelf, nothing
-- from anybody else's.
create or replace function public.cuisine_counts()
returns table (cuisine text, n bigint)
language sql
stable
set search_path = public
as $$
  select r.cuisine, count(*)::bigint as n
  from recipes r
  where r.cuisine is not null
    and btrim(r.cuisine) <> ''
  group by r.cuisine
  order by count(*) desc, r.cuisine;
$$;

grant execute on function public.cuisine_counts() to authenticated;

-- The library already holds "France" next to "Spanish", and "United States"
-- next to "British" — TheMealDB names places, not cooking. Re-seeding would fix
-- new rows; this fixes the ones already here.
update recipes set cuisine = case lower(btrim(cuisine))
  when 'united states'  then 'American'
  when 'argentina'      then 'Argentine'
  when 'france'         then 'French'
  when 'india'          then 'Indian'
  when 'netherlands'    then 'Dutch'
  when 'norway'         then 'Norwegian'
  when 'slovakia'       then 'Slovak'
  when 'venezuela'      then 'Venezuelan'
  when 'saudi arabian'  then 'Saudi'
  else cuisine
end
where lower(btrim(cuisine)) in (
  'united states', 'argentina', 'france', 'india', 'netherlands',
  'norway', 'slovakia', 'venezuela', 'saudi arabian'
);

update recipes set cuisine = null
where cuisine is not null
  and lower(btrim(cuisine)) in ('unknown', 'other', 'miscellaneous', 'none', 'various');
