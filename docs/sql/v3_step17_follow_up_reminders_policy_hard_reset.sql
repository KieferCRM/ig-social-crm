-- v3 step 17: hard reset follow_up_reminders RLS policies
-- Use this if step16 succeeded but runtime still throws
-- "column follow_up_reminders.agent_id does not exist".

begin;

-- Remove every existing policy on this table to eliminate hidden legacy references.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follow_up_reminders'
  loop
    execute format('drop policy if exists %I on public.follow_up_reminders', pol.policyname);
  end loop;
end $$;

-- Recreate canonical compatibility policies.
create policy follow_up_reminders_select_team_or_owner on public.follow_up_reminders
for select to authenticated
using (
  coalesce(
    (to_jsonb(follow_up_reminders) ->> 'owner_user_id')::uuid,
    (to_jsonb(follow_up_reminders) ->> 'agent_id')::uuid
  ) = auth.uid()
  or (team_id is not null and team_id = public.current_team_id())
);

create policy follow_up_reminders_insert_team_or_owner on public.follow_up_reminders
for insert to authenticated
with check (
  (
    coalesce(
      (to_jsonb(follow_up_reminders) ->> 'owner_user_id')::uuid,
      (to_jsonb(follow_up_reminders) ->> 'agent_id')::uuid
    ) = auth.uid()
    and (team_id is null or team_id = public.current_team_id())
  )
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

create policy follow_up_reminders_update_team_or_owner on public.follow_up_reminders
for update to authenticated
using (
  coalesce(
    (to_jsonb(follow_up_reminders) ->> 'owner_user_id')::uuid,
    (to_jsonb(follow_up_reminders) ->> 'agent_id')::uuid
  ) = auth.uid()
  or (team_id is not null and team_id = public.current_team_id())
)
with check (
  (
    coalesce(
      (to_jsonb(follow_up_reminders) ->> 'owner_user_id')::uuid,
      (to_jsonb(follow_up_reminders) ->> 'agent_id')::uuid
    ) = auth.uid()
    and (team_id is null or team_id = public.current_team_id())
  )
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

create policy follow_up_reminders_delete_owner_or_adminish on public.follow_up_reminders
for delete to authenticated
using (
  coalesce(
    (to_jsonb(follow_up_reminders) ->> 'owner_user_id')::uuid,
    (to_jsonb(follow_up_reminders) ->> 'agent_id')::uuid
  ) = auth.uid()
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

commit;
