-- auth_company_id() reads `profiles` on behalf of the caller, but wasn't
-- security definer — so it was itself subject to profiles' RLS policies.
-- Since one of those policies ("teammates in same company") also calls
-- auth_company_id(), every read of profiles recursed into itself forever
-- ("infinite recursion detected in policy for relation profiles"), which
-- Supabase's client surfaced as a silent null/empty result. That made
-- real accounts look like they had no profile — Company Profile and
-- Clients pages both fell back to their "demo mode" empty state.
create or replace function auth_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from profiles where id = auth.uid()
$$;
