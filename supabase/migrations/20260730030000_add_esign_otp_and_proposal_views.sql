alter table proposals add column if not exists otp_code text;
alter table proposals add column if not exists otp_email text;
alter table proposals add column if not exists otp_expires_at timestamptz;

create table if not exists proposal_views (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists proposal_views_proposal_id_idx on proposal_views(proposal_id);

alter table proposal_views enable row level security;
create policy "company members can read their own proposal views" on proposal_views for select
  using (
    exists (
      select 1 from proposals
      join profiles on profiles.company_id = proposals.company_id
      where proposals.id = proposal_views.proposal_id
      and profiles.id = auth.uid()
    )
  );
