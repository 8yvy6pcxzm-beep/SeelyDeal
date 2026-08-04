-- API keys were stored in plaintext (`companies.api_key`), readable in full by
-- anyone with DB access. Move to a SHA-256 hash for lookup, keeping only the
-- last 4 characters in the clear so the UI can still show "sk_live_...ab12".
create extension if not exists pgcrypto with schema extensions;

alter table companies add column if not exists api_key_hash text unique;
alter table companies add column if not exists api_key_last4 text;

update companies
set api_key_hash = encode(extensions.digest(api_key, 'sha256'), 'hex'),
    api_key_last4 = right(api_key, 4)
where api_key is not null and api_key_hash is null;

alter table companies drop column if exists api_key;
