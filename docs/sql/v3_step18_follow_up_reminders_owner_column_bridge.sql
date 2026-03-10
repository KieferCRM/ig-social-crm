-- v3 step 18: follow_up_reminders owner column bridge
-- Purpose: ensure both owner_user_id and agent_id exist and stay synchronized,
-- so legacy/new code and policies all work during migration.

begin;

alter table public.follow_up_reminders
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

alter table public.follow_up_reminders
  add column if not exists agent_id uuid references auth.users(id) on delete cascade;

-- Backfill both directions so existing rows become compatible.
update public.follow_up_reminders
set owner_user_id = coalesce(owner_user_id, agent_id),
    agent_id = coalesce(agent_id, owner_user_id)
where owner_user_id is distinct from coalesce(owner_user_id, agent_id)
   or agent_id is distinct from coalesce(agent_id, owner_user_id);

create or replace function public.sync_follow_up_reminders_owner_columns()
returns trigger
language plpgsql
as $$
begin
  if new.owner_user_id is null and new.agent_id is not null then
    new.owner_user_id := new.agent_id;
  end if;

  if new.agent_id is null and new.owner_user_id is not null then
    new.agent_id := new.owner_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_follow_up_reminders_owner_columns on public.follow_up_reminders;
create trigger trg_follow_up_reminders_owner_columns
before insert or update on public.follow_up_reminders
for each row
execute function public.sync_follow_up_reminders_owner_columns();

commit;
