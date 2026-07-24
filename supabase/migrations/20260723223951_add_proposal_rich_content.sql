alter table proposals add column if not exists intro_text text;
alter table proposals add column if not exists about_text text;
alter table proposals add column if not exists client_contact jsonb not null default '{}'::jsonb;
alter table proposals add column if not exists next_steps jsonb not null default '[]'::jsonb;
alter table proposals add column if not exists valid_days integer not null default 15;
