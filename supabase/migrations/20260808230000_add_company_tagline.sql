-- Company Profile's "Brand" card showed the tagline as a static, read-only
-- value pulled from app.config.ts. Give it a real per-company column so it's
-- editable and saveable like the rest of the brand fields.
alter table companies add column if not exists tagline text;
