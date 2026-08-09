-- Persists which of the 8 standard proposal sections a company wants included by
-- default in every new draft (set during onboarding, see the onboarding block in
-- app/api/draft-proposal/route.ts). null means "not set yet, include everything" —
-- keeps existing behavior unchanged until a company actually picks defaults.
alter table companies add column if not exists default_sections jsonb;
