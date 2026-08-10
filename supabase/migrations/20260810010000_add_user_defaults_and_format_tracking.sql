-- Faz 2: kişiye özel varsayılan profiller + HTML/PDF tercih takibi.

-- Which profile (person) drafted a proposal, and which template/output format
-- they used — needed so Seely can notice "this person keeps picking the same
-- template+format" and offer to save it as their personal default.
alter table proposals add column if not exists created_by uuid references profiles(id) on delete set null;
alter table proposals add column if not exists template_id uuid;
alter table proposals add column if not exists format text check (format in ('pdf', 'html'));

-- One row per person who has saved a personal default ("[İsim] Varsayılanı").
-- Distinct from companies.default_sections (company-wide) — this is per-profile,
-- since different teammates on the same company can want different defaults.
create table if not exists user_defaults (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  company_id uuid not null references companies(id) on delete cascade,
  label text not null,
  template_id uuid,
  preferred_format text check (preferred_format in ('pdf', 'html')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_defaults enable row level security;
create policy "own user defaults" on user_defaults for all using (company_id = auth_company_id());
