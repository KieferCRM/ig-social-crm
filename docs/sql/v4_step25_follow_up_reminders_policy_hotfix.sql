-- V4 Step 25: follow_up_reminders policy hotfix + schema cache reload
-- Use when reminder PATCH fails with: column follow_up_reminders.agent_id does not exist

begin;

alter table public.follow_up_reminders
  add column if not exists owner_user_id uuid;

alter table public.follow_up_reminders
  add column if not exists agent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.follow_up_reminders'::regclass
      and c.contype = 'f'
      and a.attname = 'owner_user_id'
  ) then
    alter table public.follow_up_reminders
      add constraint follow_up_reminders_owner_user_id_fkey
      foreign key (owner_user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.follow_up_reminders'::regclass
      and c.contype = 'f'
      and a.attname = 'agent_id'
  ) then
    alter table public.follow_up_reminders
      add constraint follow_up_reminders_agent_id_fkey
      foreign key (agent_id) references auth.users(id) on delete cascade;
  end if;
end $$;

update public.follow_up_reminders
set owner_user_id = coalesce(owner_user_id, agent_id),
    agent_id = coalesce(agent_id, owner_user_id)
where owner_user_id is distinct from coalesce(owner_user_id, agent_id)
   or agent_id is distinct from coalesce(agent_id, owner_user_id);

create or replace function public.follow_up_reminders_effective_owner(rem public.follow_up_reminders)
returns uuid
language sql
stable
as $$
  select coalesce(
    (to_jsonb(rem) ->> 'owner_user_id')::uuid,
    (to_jsonb(rem) ->> 'agent_id')::uuid
  )
$$;

alter table public.follow_up_reminders enable row level security;

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

create policy follow_up_reminders_select_owner on public.follow_up_reminders
for select to authenticated
using (public.follow_up_reminders_effective_owner(follow_up_reminders) = auth.uid());

create policy follow_up_reminders_insert_owner on public.follow_up_reminders
for insert to authenticated
with check (public.follow_up_reminders_effective_owner(follow_up_reminders) = auth.uid());

create policy follow_up_reminders_update_owner on public.follow_up_reminders
for update to authenticated
using (public.follow_up_reminders_effective_owner(follow_up_reminders) = auth.uid())
with check (public.follow_up_reminders_effective_owner(follow_up_reminders) = auth.uid());

create policy follow_up_reminders_delete_owner on public.follow_up_reminders
for delete to authenticated
using (public.follow_up_reminders_effective_owner(follow_up_reminders) = auth.uid());

notify pgrst, 'reload schema';

commit;
