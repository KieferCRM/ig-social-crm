-- Appointments table for PA calendar scheduling
-- Run in Supabase SQL editor

create table if not exists appointments (
  id                  uuid        primary key default gen_random_uuid(),
  agent_id            uuid        not null references agents(id) on delete cascade,
  lead_id             uuid        references leads(id) on delete set null,
  deal_id             uuid        references deals(id) on delete set null,
  title               text        not null,
  scheduled_at        timestamptz not null,
  duration_minutes    int         not null default 30,
  appointment_type    text        not null default 'call',
  -- call | showing | consultation | walkthrough | other
  status              text        not null default 'scheduled',
  -- scheduled | confirmed | completed | cancelled | no_show
  location            text,
  notes               text,
  confirmed_by_lead   boolean     not null default false,
  lead_reminder_sent  boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists appointments_agent_scheduled
  on appointments(agent_id, scheduled_at desc);

create index if not exists appointments_lead
  on appointments(lead_id) where lead_id is not null;

create index if not exists appointments_deal
  on appointments(deal_id) where deal_id is not null;

alter table appointments enable row level security;

create policy "agents own their appointments"
  on appointments for all
  using  (agent_id = auth.uid())
  with check (agent_id = auth.uid());
