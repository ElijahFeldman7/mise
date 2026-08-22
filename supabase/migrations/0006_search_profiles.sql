create or replace function public.search_profiles(query text)
returns table (id uuid, display_name text, email text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email, p.avatar_url
  from profiles p
  where length(trim(query)) >= 2
    and p.id <> auth.uid()
    and p.id not in (
      select hm.user_id from household_members hm
      where hm.household_id in (select public.my_household_ids())
    )
    and (
      p.display_name ilike '%' || trim(query) || '%'
      or p.email ilike '%' || trim(query) || '%'
    )
  order by p.display_name nulls last
  limit 8;
$$;

grant execute on function public.search_profiles(text) to authenticated;
