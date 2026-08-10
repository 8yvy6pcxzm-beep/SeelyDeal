-- Store the original uploaded file (PDF/DOCX) alongside the extracted text, so the
-- content library can show a real visual preview instead of just the AI-readable text.
-- Bucket is private (unlike `logos`) — company documents can contain pricing/contract
-- terms — reads go through signed URLs generated server-side after an auth check.
alter table company_documents add column if not exists file_path text;
alter table company_documents add column if not exists file_mime text;
alter table company_documents add column if not exists file_name text;

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

create policy "companies can read their own documents"
  on storage.objects for select
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can upload their own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can replace their own documents"
  on storage.objects for update
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can delete their own documents"
  on storage.objects for delete
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );
