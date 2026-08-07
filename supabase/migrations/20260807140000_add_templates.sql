-- Reusable proposal templates a company builds once (e.g. an industry-specific template)
-- and drafts new proposals from. Same shape as proposals, minus client/status/value.
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  industry text,
  sections jsonb not null default '[]'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  contract_text text,
  intro_text text,
  about_text text,
  next_steps jsonb not null default '[]'::jsonb,
  billing_options jsonb not null default '[]'::jsonb,
  valid_days integer not null default 15,
  created_at timestamptz not null default now()
);

alter table templates enable row level security;

create policy "own templates" on templates for all using (company_id = auth_company_id());
