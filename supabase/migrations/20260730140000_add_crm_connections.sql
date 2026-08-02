create table if not exists crm_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  webhook_secret text,
  field_mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create table if not exists crm_webhook_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references crm_connections(id) on delete cascade,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists crm_connections_company_id_idx on crm_connections(company_id);
create index if not exists crm_webhook_events_connection_id_idx on crm_webhook_events(connection_id);

alter table crm_connections enable row level security;
create policy "company members can read their own crm connections" on crm_connections for select
  using (
    exists (
      select 1 from profiles
      where profiles.company_id = crm_connections.company_id
      and profiles.id = auth.uid()
    )
  );

alter table crm_webhook_events enable row level security;
create policy "company members can read their own crm webhook events" on crm_webhook_events for select
  using (
    exists (
      select 1 from crm_connections
      join profiles on profiles.company_id = crm_connections.company_id
      where crm_connections.id = crm_webhook_events.connection_id
      and profiles.id = auth.uid()
    )
  );
