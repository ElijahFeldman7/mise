alter table receipts add column if not exists location text;
alter table receipts add column if not exists phone    text;
alter table receipts add column if not exists tax      numeric;

alter table receipt_lines add column if not exists quantity numeric;
