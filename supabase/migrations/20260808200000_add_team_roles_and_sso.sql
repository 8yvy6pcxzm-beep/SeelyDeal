-- Real "user roles and permissions" + "SSO support" for the Custom plan
-- (Settings → Access — see components/app/team-roles-card.tsx and sso-card.tsx).

-- Widen profiles.role beyond owner/member, and give each seat per-area permissions.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('owner', 'admin', 'member', 'viewer'));
alter table profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists email text;

-- Pending seats: someone invited by email who hasn't signed up (or logged in) yet.
-- On signup, complete-signup.ts checks this table by email and joins the inviting
-- company with the invited role/permissions instead of creating a brand-new company.
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

alter table team_invites enable row level security;
create policy "own invites" on team_invites for all using (company_id = auth_company_id());

-- Owners/admins need to see and edit their teammates' rows too, not just their own.
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select using (id = auth.uid());
create policy "teammates in same company" on profiles for select using (company_id = auth_company_id());
create policy "admins manage teammates" on profiles for update using (
  company_id = auth_company_id()
  and exists (
    select 1 from profiles me
    where me.id = auth.uid() and me.role in ('owner', 'admin')
  )
);

-- SSO config: one enterprise identity-provider connection per company.
alter table companies add column if not exists sso_enabled boolean not null default false;
alter table companies add column if not exists sso_provider text check (sso_provider in ('okta', 'azure_ad', 'salesforce'));
alter table companies add column if not exists sso_domain text;
alter table companies add column if not exists sso_metadata_url text;
alter table companies add column if not exists sso_configured_at timestamptz;
