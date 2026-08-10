-- "Antet" (letterhead) info — address + phone alongside the existing name/email/logo,
-- so the company's own side of a proposal (and any future letterhead-style export)
-- can show full contact details, not just an email.
alter table companies add column if not exists address text;
alter table companies add column if not exists phone text;
