alter table company_documents add column if not exists is_default_template boolean not null default false;
