-- v3 step 15: RLS recursion hotfix for team_members
-- Root issue: team_members policies call helper functions that queried team_members
-- under invoker context, causing recursive policy evaluation and stack depth errors.

begin;

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select tm.team_id
  from public.team_members tm
  where tm.user_id = auth.uid()
    and tm.status = 'active'
  order by tm.joined_at asc
  limit 1
$$;

create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select tm.role
  from public.team_members tm
  where tm.user_id = auth.uid()
    and tm.status = 'active'
  order by tm.joined_at asc
  limit 1
$$;

-- Keep helper execution explicit.
revoke all on function public.current_team_id() from public;
revoke all on function public.current_team_role() from public;
grant execute on function public.current_team_id() to authenticated, service_role;
grant execute on function public.current_team_role() to authenticated, service_role;

-- Avoid policy dead-ends for first-party membership lookups (used by loadTeamContext).
drop policy if exists team_members_select_visible on public.team_members;
create policy team_members_select_visible on public.team_members
for select to authenticated
using (
  user_id = auth.uid()
  or team_id = public.current_team_id()
);

commit;
