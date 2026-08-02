alter table proposals add column if not exists live_selection jsonb;
alter table proposals add column if not exists live_selection_at timestamptz;
