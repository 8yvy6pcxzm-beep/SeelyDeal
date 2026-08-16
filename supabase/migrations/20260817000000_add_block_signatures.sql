-- Per-block signature audit trail. The overall proposal accept/sign flow
-- (proposals.signed_at/signed_by_name/signed_ip/...) already exists and is
-- unaffected — this adds a second, finer-grained layer so individual Legal
-- blocks (settings.requireSignature) and the ContractSignOff block can each
-- be signed and audited on their own, independent of the final "Accept &
-- Sign" action. One row per (proposal, block); re-signing updates it in place.
-- Two-party model: each block can carry ONE "company" signature (the sending
-- team, signed in-app while authenticated) and ONE "client" signature (the
-- recipient, signed on the public page, optionally OTP-verified) — not an
-- open-ended signer list. Re-signing the SAME role updates that row in place;
-- the two roles never overwrite each other.
create table if not exists block_signatures (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  block_id text not null,
  block_type text not null,
  signer_role text not null default 'client' check (signer_role in ('company', 'client')),
  signer_name text not null,
  signer_email text,
  otp_verified boolean not null default false,
  ip text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (proposal_id, block_id, signer_role)
);

create index if not exists block_signatures_proposal_id_idx on block_signatures(proposal_id);

alter table block_signatures enable row level security;

create policy "company members can read their proposal block signatures" on block_signatures for select
  using (
    exists (
      select 1 from proposals
      join profiles on profiles.company_id = proposals.company_id
      where proposals.id = block_signatures.proposal_id
      and profiles.id = auth.uid()
    )
  );
