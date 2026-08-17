-- Adds two more company_documents categories geared at the library's real use case
-- (showcasing the company's own example proposals, references, and general materials)
-- alongside the existing ones. Old rows keep their type unchanged.
alter table company_documents drop constraint if exists company_documents_type_check;
alter table company_documents add constraint company_documents_type_check
  check (type in ('contract', 'proposal_template', 'service_description', 'other', 'content_block', 'reference', 'company_material'));
