-- Adds a "content_block" company_documents type for SeelyDeal's own ready-made
-- proposal content suggestions (shown in the new İçerik Kütüphanesi page's
-- "Hazır İçerikler" section) — distinct from the company's own uploaded
-- examples (proposal_template/contract/service_description/other).
alter table company_documents drop constraint if exists company_documents_type_check;
alter table company_documents add constraint company_documents_type_check
  check (type in ('contract', 'proposal_template', 'service_description', 'other', 'content_block'));
