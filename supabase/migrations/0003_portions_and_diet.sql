-- 0003 — how many people the house cooks for.

alter table households add column if not exists cooks_for int not null default 2;

alter table households drop constraint if exists households_cooks_for_check;
alter table households add constraint households_cooks_for_check
  check (cooks_for between 1 and 20);
