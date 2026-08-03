-- Document library (company_documents) is a Pro/Custom feature — Lite (starter) trial
-- accounts can still see/manage rows left over from a downgrade, but can't create new ones.
drop policy if exists "own documents" on company_documents;

create policy "own documents read" on company_documents for select using (company_id = auth_company_id());
create policy "own documents write" on company_documents for update using (company_id = auth_company_id());
create policy "own documents delete" on company_documents for delete using (company_id = auth_company_id());
create policy "own documents insert" on company_documents for insert
  with check (
    company_id = auth_company_id()
    and (select plan from companies where id = company_id) <> 'starter'
  );
