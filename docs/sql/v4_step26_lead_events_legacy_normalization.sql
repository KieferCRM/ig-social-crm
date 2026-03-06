-- V4 Step 26: lead_events legacy normalization + solo RLS hardening
-- Use when lead_events writes fail due to legacy contact_id/source constraints.

begin;

create extension if not exists pgcrypto;

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  agent_id uuid references auth.users(id) on delete cascade,
  event_type text,
  event_data jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.lead_events
  add column if not exists lead_id uuid references public.leads(id) on delete cascade;

alter table public.lead_events
  add column if not exists agent_id uuid references auth.users(id) on delete cascade;

alter table public.lead_events
  add column if not exists event_type text;

alter table public.lead_events
  add column if not exists event_data jsonb not null default '{}'::jsonb;

alter table public.lead_events
  add column if not exists actor_id uuid references auth.users(id) on delete set null;

alter table public.lead_events
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_events'
      and column_name = 'contact_id'
      and is_nullable = 'NO'
  ) then
    alter table public.lead_events
      alter column contact_id drop not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.lead_events'::regclass
      and c.contype = 'f'
      and a.attname = 'lead_id'
  ) then
    alter table public.lead_events
      add constraint lead_events_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.lead_events'::regclass
      and c.contype = 'f'
      and a.attname = 'agent_id'
  ) then
    alter table public.lead_events
      add constraint lead_events_agent_id_fkey
      foreign key (agent_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.lead_events'::regclass
      and c.contype = 'f'
      and a.attname = 'actor_id'
  ) then
    alter table public.lead_events
      add constraint lead_events_actor_id_fkey
      foreign key (actor_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- If contact_id stores a lead uuid in old schemas, lift it into lead_id.
update public.lead_events le
set lead_id = (to_jsonb(le) ->> 'contact_id')::uuid
where lead_id is null
  and (to_jsonb(le) ? 'contact_id')
  and (to_jsonb(le) ->> 'contact_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.leads l
    where l.id = (to_jsonb(le) ->> 'contact_id')::uuid
  );

-- Backfill agent_id from owner hints and linked lead.
update public.lead_events le
set agent_id = coalesce(
  le.agent_id,
  nullif(to_jsonb(le) ->> 'owner_user_id', '')::uuid,
  nullif(to_jsonb(le) ->> 'assignee_user_id', '')::uuid,
  l.agent_id,
  l.owner_user_id,
  l.assignee_user_id
)
from public.leads l
where le.agent_id is null
  and le.lead_id = l.id;

update public.lead_events
set event_type = coalesce(nullif(trim(event_type), ''), 'legacy_event'),
    event_data = coalesce(event_data, '{}'::jsonb),
    created_at = coalesce(created_at, now())
where event_type is null
   or nullif(trim(event_type), '') is null
   or event_data is null
   or created_at is null;

alter table public.lead_events
  alter column event_data set default '{}'::jsonb;

alter table public.lead_events
  alter column created_at set default now();

create index if not exists idx_lead_events_agent_time
  on public.lead_events (agent_id, created_at desc);

create index if not exists idx_lead_events_lead_time
  on public.lead_events (lead_id, created_at desc);

alter table public.lead_events enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_events'
  loop
    execute format('drop policy if exists %I on public.lead_events', pol.policyname);
  end loop;
end $$;

create policy lead_events_select_owner on public.lead_events
for select to authenticated
using (agent_id = auth.uid());

create policy lead_events_insert_owner on public.lead_events
for insert to authenticated
with check (agent_id = auth.uid());

create policy lead_events_update_owner on public.lead_events
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy lead_events_delete_owner on public.lead_events
for delete to authenticated
using (agent_id = auth.uid());

notify pgrst, 'reload schema';

commit;
