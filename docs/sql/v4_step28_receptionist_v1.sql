-- V4 Step 28: LockboxHQ Receptionist V1 foundations
-- Adds shared communication logging + alert primitives for SMS/call receptionist workflows.

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

alter table public.leads
  add column if not exists urgency_level text;

alter table public.leads
  add column if not exists urgency_score integer;

alter table public.leads
  add column if not exists last_communication_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_urgency_level_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_urgency_level_check
      check (urgency_level is null or urgency_level in ('normal','high'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_urgency_score_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_urgency_score_check
      check (urgency_score is null or (urgency_score >= 0 and urgency_score <= 100));
  end if;
end $$;

create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null,
  direction text not null,
  interaction_type text not null,
  status text not null default 'logged',
  raw_transcript text,
  raw_message_body text,
  summary text,
  structured_payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  provider_call_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_interactions
  add column if not exists agent_id uuid references auth.users(id) on delete cascade;

alter table public.lead_interactions
  add column if not exists lead_id uuid references public.leads(id) on delete cascade;

alter table public.lead_interactions
  add column if not exists channel text;

alter table public.lead_interactions
  add column if not exists direction text;

alter table public.lead_interactions
  add column if not exists interaction_type text;

alter table public.lead_interactions
  add column if not exists status text not null default 'logged';

alter table public.lead_interactions
  add column if not exists raw_transcript text;

alter table public.lead_interactions
  add column if not exists raw_message_body text;

alter table public.lead_interactions
  add column if not exists summary text;

alter table public.lead_interactions
  add column if not exists structured_payload jsonb not null default '{}'::jsonb;

alter table public.lead_interactions
  add column if not exists provider_message_id text;

alter table public.lead_interactions
  add column if not exists provider_call_id text;

alter table public.lead_interactions
  add column if not exists created_at timestamptz not null default now();

alter table public.lead_interactions
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_interactions_channel_check'
      and conrelid = 'public.lead_interactions'::regclass
  ) then
    alter table public.lead_interactions
      add constraint lead_interactions_channel_check
      check (channel in ('sms','missed_call_textback','call_outbound','call_inbound','system','voice'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_interactions_direction_check'
      and conrelid = 'public.lead_interactions'::regclass
  ) then
    alter table public.lead_interactions
      add constraint lead_interactions_direction_check
      check (direction in ('in','out','system'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_interactions_status_check'
      and conrelid = 'public.lead_interactions'::regclass
  ) then
    alter table public.lead_interactions
      add constraint lead_interactions_status_check
      check (status in ('queued','sent','delivered','received','missed','completed','failed','logged'));
  end if;
end $$;

create index if not exists idx_lead_interactions_agent_lead_created
  on public.lead_interactions (agent_id, lead_id, created_at desc);

create index if not exists idx_lead_interactions_lead_created
  on public.lead_interactions (lead_id, created_at desc);

create unique index if not exists idx_lead_interactions_agent_provider_message
  on public.lead_interactions (agent_id, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_lead_interactions_agent_provider_call
  on public.lead_interactions (agent_id, provider_call_id)
  where provider_call_id is not null;

create table if not exists public.receptionist_alerts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  alert_type text not null,
  severity text not null default 'high',
  title text not null,
  message text not null,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.receptionist_alerts
  add column if not exists agent_id uuid references auth.users(id) on delete cascade;

alter table public.receptionist_alerts
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.receptionist_alerts
  add column if not exists alert_type text;

alter table public.receptionist_alerts
  add column if not exists severity text not null default 'high';

alter table public.receptionist_alerts
  add column if not exists title text;

alter table public.receptionist_alerts
  add column if not exists message text;

alter table public.receptionist_alerts
  add column if not exists status text not null default 'open';

alter table public.receptionist_alerts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.receptionist_alerts
  add column if not exists created_at timestamptz not null default now();

alter table public.receptionist_alerts
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receptionist_alerts_severity_check'
      and conrelid = 'public.receptionist_alerts'::regclass
  ) then
    alter table public.receptionist_alerts
      add constraint receptionist_alerts_severity_check
      check (severity in ('info','high','urgent'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'receptionist_alerts_status_check'
      and conrelid = 'public.receptionist_alerts'::regclass
  ) then
    alter table public.receptionist_alerts
      add constraint receptionist_alerts_status_check
      check (status in ('open','acknowledged','resolved'));
  end if;
end $$;

create index if not exists idx_receptionist_alerts_agent_created
  on public.receptionist_alerts (agent_id, created_at desc);

create index if not exists idx_receptionist_alerts_agent_status
  on public.receptionist_alerts (agent_id, status, created_at desc);

alter table public.lead_interactions enable row level security;
alter table public.receptionist_alerts enable row level security;

drop trigger if exists trg_lead_interactions_updated_at on public.lead_interactions;
create trigger trg_lead_interactions_updated_at
before update on public.lead_interactions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_receptionist_alerts_updated_at on public.receptionist_alerts;
create trigger trg_receptionist_alerts_updated_at
before update on public.receptionist_alerts
for each row
execute function public.set_updated_at();

drop policy if exists lead_interactions_select_owner on public.lead_interactions;
drop policy if exists lead_interactions_insert_owner on public.lead_interactions;
drop policy if exists lead_interactions_update_owner on public.lead_interactions;
drop policy if exists lead_interactions_delete_owner on public.lead_interactions;

create policy lead_interactions_select_owner on public.lead_interactions
for select to authenticated
using (agent_id = auth.uid());

create policy lead_interactions_insert_owner on public.lead_interactions
for insert to authenticated
with check (agent_id = auth.uid());

create policy lead_interactions_update_owner on public.lead_interactions
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy lead_interactions_delete_owner on public.lead_interactions
for delete to authenticated
using (agent_id = auth.uid());

drop policy if exists receptionist_alerts_select_owner on public.receptionist_alerts;
drop policy if exists receptionist_alerts_insert_owner on public.receptionist_alerts;
drop policy if exists receptionist_alerts_update_owner on public.receptionist_alerts;
drop policy if exists receptionist_alerts_delete_owner on public.receptionist_alerts;

create policy receptionist_alerts_select_owner on public.receptionist_alerts
for select to authenticated
using (agent_id = auth.uid());

create policy receptionist_alerts_insert_owner on public.receptionist_alerts
for insert to authenticated
with check (agent_id = auth.uid());

create policy receptionist_alerts_update_owner on public.receptionist_alerts
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy receptionist_alerts_delete_owner on public.receptionist_alerts
for delete to authenticated
using (agent_id = auth.uid());

commit;
