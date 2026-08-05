-- Custom-plan "premium design services" — a custom cover image per company,
-- used on the public proposal page cover instead of the flat brand-color
-- gradient. Same storage pattern as the logos bucket added earlier.
alter table companies add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "covers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "companies can upload their own cover"
  on storage.objects for insert
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can replace their own cover"
  on storage.objects for update
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

create policy "companies can delete their own cover"
  on storage.objects for delete
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );
