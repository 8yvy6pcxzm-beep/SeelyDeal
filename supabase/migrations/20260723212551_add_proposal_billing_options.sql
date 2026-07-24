alter table proposals add column if not exists billing_options jsonb not null default '[]'::jsonb;
alter table proposals add column if not exists selected_billing text;
