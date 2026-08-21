-- 0005 — things you'd rather not eat, as opposed to things you won't.

alter table profiles
  add column if not exists disliked_ingredients text[] not null default '{}';
