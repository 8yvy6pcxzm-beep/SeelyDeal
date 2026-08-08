-- Tracks each user's KVKK / privacy-policy consent at signup (required to prove
-- consent was given — see components/auth/auth-screen.tsx signup checkbox).
alter table profiles add column if not exists consent_at timestamptz;
