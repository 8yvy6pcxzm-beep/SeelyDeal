-- Public storage bucket for company logos, uploaded from Settings (replaces the paste-a-URL-only flow).
-- Path convention: {company_id}/logo.<ext> — enforced by the insert/update policies below so a company
-- can only ever write into its own folder (auth_company_id() is already defined in schema.sql).
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "companies can upload their own logo"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can replace their own logo"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can delete their own logo"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );
