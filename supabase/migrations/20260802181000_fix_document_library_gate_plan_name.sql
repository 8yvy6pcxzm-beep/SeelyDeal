-- The document-library insert gate (20260802173000) checked plan <> 'starter', but the
-- rename migration (20260802180000) that runs after it renames that tier to 'lite'. Re-point
-- the check at the new name so Lite trial accounts stay correctly blocked from inserting.
drop policy if exists "own documents insert" on company_documents;

create policy "own documents insert" on company_documents for insert
  with check (
    company_id = auth_company_id()
    and (select plan from companies where id = company_id) <> 'lite'
  );
