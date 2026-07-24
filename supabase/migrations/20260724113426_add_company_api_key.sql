alter table companies add column if not exists api_key text unique;

create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  month text not null,
  count integer not null default 0,
  unique (company_id, month)
);

alter table api_usage enable row level security;
create policy "own api usage" on api_usage for all using (company_id = auth_company_id());
