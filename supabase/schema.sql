-- SeelyDeal schema: companies, team, documents, clients, proposals, AI usage, real accounts.
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists "pgcrypto";

-- One row per business using SeelyDeal (the app's real customer, e.g. "Acme Consulting").
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text,
  font text,
  email text,
  plan text not null default 'lite' check (plan in ('lite', 'pro', 'custom')),
  ai_monthly_limit integer not null default 10,
  sso_enabled boolean not null default false,
  sso_provider text check (sso_provider in ('okta', 'azure_ad', 'salesforce')),
  sso_domain text,
  sso_metadata_url text,
  sso_configured_at timestamptz,
  created_at timestamptz not null default now()
);

-- People at the company who prepare/sign proposals (name, title, photo).
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  title text,
  photo_url text,
  email text,
  created_at timestamptz not null default now()
);

-- Reusable documents per company: standard contracts, proposal formats, service blurbs.
create table if not exists company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in ('contract', 'proposal_template', 'service_description', 'other')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The company's own clients (who proposals get sent to).
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text,
  website text,
  created_at timestamptz not null default now()
);

-- Real proposals (replaces/augments the static demo rows).
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  value numeric not null default 0,
  sections jsonb not null default '[]'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  contract_text text,
  payment_link text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusable proposal templates a company builds once and drafts new proposals from.
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

-- One row per company per calendar month, counts AI drafting calls against the plan limit.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  count integer not null default 0,
  unique (company_id, month)
);

-- Links a real Supabase Auth user to their company (many users -> one company, for Growth/Scale seats).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  permissions jsonb not null default '{}'::jsonb,
  email text,
  created_at timestamptz not null default now()
);

-- Pending seats invited by email, joined to the company on signup (Custom plan "user roles" feature).
create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

-- ── Row Level Security: every table scoped to the caller's own company ────────
alter table companies enable row level security;
alter table team_members enable row level security;
alter table company_documents enable row level security;
alter table clients enable row level security;
alter table proposals enable row level security;
alter table templates enable row level security;
alter table ai_usage enable row level security;
alter table profiles enable row level security;
alter table team_invites enable row level security;

create or replace function auth_company_id()
returns uuid
language sql stable
as $$
  select company_id from profiles where id = auth.uid()
$$;

create policy "own company" on companies for select using (id = auth_company_id());
create policy "own company update" on companies for update using (id = auth_company_id());

create policy "own team" on team_members for all using (company_id = auth_company_id());
create policy "own documents" on company_documents for all using (company_id = auth_company_id());
create policy "own clients" on clients for all using (company_id = auth_company_id());
create policy "own proposals" on proposals for all using (company_id = auth_company_id());
create policy "own templates" on templates for all using (company_id = auth_company_id());
create policy "own usage" on ai_usage for all using (company_id = auth_company_id());
create policy "own invites" on team_invites for all using (company_id = auth_company_id());
create policy "own profile" on profiles for select using (id = auth.uid());
create policy "teammates in same company" on profiles for select using (company_id = auth_company_id());
create policy "admins manage teammates" on profiles for update using (
  company_id = auth_company_id()
  and exists (
    select 1 from profiles me
    where me.id = auth.uid() and me.role in ('owner', 'admin')
  )
);

-- If you already ran this schema before payment_link/signed_at existed, run just this:
-- alter table proposals add column if not exists payment_link text;
-- alter table proposals add column if not exists signed_at timestamptz;
