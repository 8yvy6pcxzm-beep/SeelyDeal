create table if not exists proposal_view_sections (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references proposal_views(id) on delete cascade,
  section_index int not null,
  seconds numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists proposal_view_sections_view_id_idx on proposal_view_sections(view_id);

alter table proposal_view_sections enable row level security;
create policy "company members can read their own proposal view sections" on proposal_view_sections for select
  using (
    exists (
      select 1 from proposal_views
      join proposals on proposals.id = proposal_views.proposal_id
      join profiles on profiles.company_id = proposals.company_id
      where proposal_views.id = proposal_view_sections.view_id
      and profiles.id = auth.uid()
    )
  );
