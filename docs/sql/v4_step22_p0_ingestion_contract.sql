-- V4 Step 22: P0 ingestion contract + consent + solo RLS hardening
-- Implements audit-critical foundations: consent fields, timeline, ingestion_events with idempotency/DLQ.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.agents (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  plan text not null default 'free' check (plan in ('free','starter','pro')),
  webhook_secret text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bootstrap tenant/ownership columns for older leads schemas.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'agent_id'
  ) then
    execute 'alter table public.leads add column agent_id uuid';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'owner_user_id'
  ) then
    execute 'alter table public.leads add column owner_user_id uuid';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'assignee_user_id'
  ) then
    execute 'alter table public.leads add column assignee_user_id uuid';
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
    where c.conrelid = 'public.leads'::regclass
      and c.contype = 'f'
      and a.attname = 'agent_id'
  ) then
    alter table public.leads
      add constraint leads_agent_id_fkey
      foreign key (agent_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.leads'::regclass
      and c.contype = 'f'
      and a.attname = 'owner_user_id'
  ) then
    alter table public.leads
      add constraint leads_owner_user_id_fkey
      foreign key (owner_user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.leads'::regclass
      and c.contype = 'f'
      and a.attname = 'assignee_user_id'
  ) then
    alter table public.leads
      add constraint leads_assignee_user_id_fkey
      foreign key (assignee_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.leads
  add column if not exists source text;

alter table public.leads
  add column if not exists time_last_updated timestamptz not null default now();

update public.leads
set time_last_updated = now()
where time_last_updated is null;

alter table public.leads
  alter column time_last_updated set default now();

alter table public.leads
  add column if not exists canonical_email text;

alter table public.leads
  add column if not exists canonical_phone text;

alter table public.leads
  add column if not exists raw_email text;

alter table public.leads
  add column if not exists raw_phone text;

alter table public.leads
  add column if not exists first_name text;

alter table public.leads
  add column if not exists last_name text;

alter table public.leads
  add column if not exists full_name text;

alter table public.leads
  add column if not exists source_ref_id text;

alter table public.leads
  add column if not exists consent_to_email boolean not null default false;

alter table public.leads
  add column if not exists consent_to_sms boolean not null default false;

alter table public.leads
  add column if not exists consent_source text;

alter table public.leads
  add column if not exists consent_timestamp timestamptz;

alter table public.leads
  add column if not exists consent_text_snapshot text;

alter table public.leads
  add column if not exists tags text[] not null default '{}'::text[];

alter table public.leads
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table public.leads
  add column if not exists deleted_at timestamptz;

update public.leads
set agent_id = coalesce(agent_id, owner_user_id, assignee_user_id),
    owner_user_id = coalesce(owner_user_id, agent_id, assignee_user_id),
    assignee_user_id = coalesce(assignee_user_id, owner_user_id, agent_id),
    canonical_email = coalesce(canonical_email, nullif(lower(trim(raw_email)), '')),
    canonical_phone = coalesce(canonical_phone, nullif(regexp_replace(coalesce(raw_phone, ''), '[^0-9+]', '', 'g'), '')),
    full_name = coalesce(full_name, nullif(trim(concat_ws(' ', first_name, last_name)), '')),
    consent_to_email = coalesce(consent_to_email, false),
    consent_to_sms = coalesce(consent_to_sms, false),
    custom_fields = coalesce(custom_fields, '{}'::jsonb),
    tags = coalesce(tags, '{}'::text[])
where true;

create unique index if not exists idx_leads_agent_canonical_email_unique
  on public.leads (agent_id, canonical_email)
  where canonical_email is not null and deleted_at is null;

create unique index if not exists idx_leads_agent_canonical_phone_unique
  on public.leads (agent_id, canonical_phone)
  where canonical_phone is not null and deleted_at is null;

create unique index if not exists idx_leads_agent_source_ref_unique
  on public.leads (agent_id, source, source_ref_id)
  where source_ref_id is not null and deleted_at is null;

create index if not exists idx_leads_agent_last_updated
  on public.leads (agent_id, time_last_updated desc);

create index if not exists idx_leads_agent_deleted_at
  on public.leads (agent_id, deleted_at);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Backfill/normalize shape in case lead_events already existed with older columns.
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

create index if not exists idx_lead_events_agent_time
  on public.lead_events (agent_id, created_at desc);

create index if not exists idx_lead_events_lead_time
  on public.lead_events (lead_id, created_at desc);

create table if not exists public.ingestion_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (length(trim(source)) > 0),
  external_event_id text not null check (length(trim(external_event_id)) > 0),
  payload_hash text not null check (length(trim(payload_hash)) > 0),
  status text not null default 'received' check (status in ('received','processed','failed','dlq')),
  error_message text,
  attempt_count integer not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  lead_id_created uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Backfill/normalize shape in case ingestion_events already existed with older columns.
alter table public.ingestion_events
  add column if not exists agent_id uuid references auth.users(id) on delete cascade;

alter table public.ingestion_events
  add column if not exists source text;

alter table public.ingestion_events
  add column if not exists external_event_id text;

alter table public.ingestion_events
  add column if not exists payload_hash text;

alter table public.ingestion_events
  add column if not exists status text not null default 'received';

alter table public.ingestion_events
  add column if not exists error_message text;

alter table public.ingestion_events
  add column if not exists attempt_count integer not null default 0;

alter table public.ingestion_events
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table public.ingestion_events
  add column if not exists lead_id_created uuid references public.leads(id) on delete set null;

alter table public.ingestion_events
  add column if not exists created_at timestamptz not null default now();

alter table public.ingestion_events
  add column if not exists updated_at timestamptz not null default now();

alter table public.ingestion_events
  add column if not exists processed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ingestion_events_status_check'
      and conrelid = 'public.ingestion_events'::regclass
  ) then
    alter table public.ingestion_events
      add constraint ingestion_events_status_check
      check (status in ('received','processed','failed','dlq'));
  end if;
end $$;

create unique index if not exists idx_ingestion_events_idempotency
  on public.ingestion_events (agent_id, source, external_event_id);

create index if not exists idx_ingestion_events_status_created
  on public.ingestion_events (status, created_at asc);

create index if not exists idx_ingestion_events_agent_status
  on public.ingestion_events (agent_id, status, updated_at asc);

alter table public.leads enable row level security;
alter table public.agents enable row level security;
alter table public.lead_events enable row level security;
alter table public.ingestion_events enable row level security;

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row
execute function public.set_updated_at();

drop trigger if exists trg_ingestion_events_updated_at on public.ingestion_events;
create trigger trg_ingestion_events_updated_at
before update on public.ingestion_events
for each row
execute function public.set_updated_at();

-- Leads policies: force strict solo ownership on agent_id.
drop policy if exists leads_select_team_or_owner on public.leads;
drop policy if exists leads_insert_team_or_owner on public.leads;
drop policy if exists leads_update_team_or_owner on public.leads;
drop policy if exists leads_delete_owner_or_adminish on public.leads;
drop policy if exists leads_select_own on public.leads;
drop policy if exists leads_insert_own on public.leads;
drop policy if exists leads_update_own on public.leads;
drop policy if exists leads_delete_own on public.leads;
drop policy if exists leads_select_owner on public.leads;
drop policy if exists leads_insert_owner on public.leads;
drop policy if exists leads_update_owner on public.leads;
drop policy if exists leads_delete_owner on public.leads;

create policy leads_select_owner on public.leads
for select to authenticated
using (agent_id = auth.uid());

create policy leads_insert_owner on public.leads
for insert to authenticated
with check (agent_id = auth.uid());

create policy leads_update_owner on public.leads
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy leads_delete_owner on public.leads
for delete to authenticated
using (agent_id = auth.uid());

-- Agents policies

drop policy if exists agents_select_owner on public.agents;
drop policy if exists agents_insert_owner on public.agents;
drop policy if exists agents_update_owner on public.agents;
drop policy if exists agents_delete_owner on public.agents;

create policy agents_select_owner on public.agents
for select to authenticated
using (id = auth.uid());

create policy agents_insert_owner on public.agents
for insert to authenticated
with check (id = auth.uid());

create policy agents_update_owner on public.agents
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy agents_delete_owner on public.agents
for delete to authenticated
using (id = auth.uid());

-- Lead events policies

drop policy if exists lead_events_select_owner on public.lead_events;
drop policy if exists lead_events_insert_owner on public.lead_events;
drop policy if exists lead_events_update_owner on public.lead_events;
drop policy if exists lead_events_delete_owner on public.lead_events;

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

-- Ingestion events policies

drop policy if exists ingestion_events_select_owner on public.ingestion_events;
drop policy if exists ingestion_events_insert_owner on public.ingestion_events;
drop policy if exists ingestion_events_update_owner on public.ingestion_events;
drop policy if exists ingestion_events_delete_owner on public.ingestion_events;

create policy ingestion_events_select_owner on public.ingestion_events
for select to authenticated
using (agent_id = auth.uid());

create policy ingestion_events_insert_owner on public.ingestion_events
for insert to authenticated
with check (agent_id = auth.uid());

create policy ingestion_events_update_owner on public.ingestion_events
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy ingestion_events_delete_owner on public.ingestion_events
for delete to authenticated
using (agent_id = auth.uid());

commit;
