alter table proposals add column if not exists payment_link text;
alter table proposals add column if not exists signed_at timestamptz;
