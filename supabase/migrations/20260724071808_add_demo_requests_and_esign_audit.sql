create table if not exists demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  message text,
  tier text,
  created_at timestamptz not null default now()
);

alter table demo_requests enable row level security;
create policy "anyone can submit a demo request" on demo_requests for insert with check (true);

alter table proposals add column if not exists signed_by_name text;
alter table proposals add column if not exists signed_ip text;
alter table proposals add column if not exists signed_user_agent text;
