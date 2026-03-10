-- v3 step 16: follow_up_reminders owner-column compatibility for RLS
-- Fixes reminder update failures when environments differ on owner column
-- naming (`owner_user_id` vs legacy `agent_id`).

begin;

drop policy if exists follow_up_reminders_select_team_or_owner on public.follow_up_reminders;
create policy follow_up_reminders_select_team_or_owner on public.follow_up_reminders
for select to authenticated
using (
  coalesce(
    (to_jsonb(follow_up_reminders) ->> 'owner_user_id')::uuid,
    (to_jsonb(follow_up_reminders) ->> 'agent_id')::uuid
  ) = auth.uid()
  or (team_id is not null and team_id = public.current_team_id())
);

drop policy if exists follow_up_reminders_insert_team_or_owner on public.follow_up_reminders;
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

drop policy if exists follow_up_reminders_update_team_or_owner on public.follow_up_reminders;
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

drop policy if exists follow_up_reminders_delete_owner_or_adminish on public.follow_up_reminders;
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
