-- V4 Step 20 foundation: lead intelligence pipeline (solo-first)
-- Adds signal capture, identity resolution, intent extraction, timeline, and decision-support primitives.

begin;

create extension if not exists pgcrypto;

create table if not exists public.lead_people (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  display_name text,
  canonical_email text,
  canonical_phone text,
  canonical_handle text,
  resolution_confidence numeric(4,3) not null default 0.900 check (resolution_confidence >= 0 and resolution_confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_signal_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  person_id uuid references public.lead_people(id) on delete set null,
  source text not null default 'manual',
  channel text not null default 'other' check (channel in ('website','sms','email','instagram','facebook','phone','referral','appointment','other')),
  event_type text not null,
  occurred_at timestamptz not null default now(),
  identity jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  message_text text,
  intent_label text,
  location_interest text,
  timeline_hint text,
  price_min numeric(12,2),
  price_max numeric(12,2),
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.lead_identity_fragments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.lead_people(id) on delete cascade,
  source_event_id uuid references public.lead_signal_events(id) on delete set null,
  fragment_type text not null check (fragment_type in ('email','phone','ig','fb','external_id','name')),
  fragment_value text not null,
  fragment_normalized text not null,
  confidence numeric(4,3) not null default 1.000 check (confidence >= 0 and confidence <= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, fragment_type, fragment_normalized)
);

create table if not exists public.lead_intent_signals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  person_id uuid references public.lead_people(id) on delete set null,
  source_event_id uuid references public.lead_signal_events(id) on delete set null,
  intent_type text,
  location_interest text,
  timeline_window text,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  extracted_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_recommendations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  person_id uuid references public.lead_people(id) on delete set null,
  source_event_id uuid references public.lead_signal_events(id) on delete set null,
  reason_code text not null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','done','dismissed')),
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_people_agent_owner on public.lead_people (agent_id, owner_user_id, updated_at desc);
create index if not exists idx_lead_people_lead on public.lead_people (lead_id);

create index if not exists idx_lead_signal_events_owner_time on public.lead_signal_events (owner_user_id, occurred_at desc);
create index if not exists idx_lead_signal_events_agent_time on public.lead_signal_events (agent_id, occurred_at desc);
create index if not exists idx_lead_signal_events_lead on public.lead_signal_events (lead_id, occurred_at desc);
create index if not exists idx_lead_signal_events_person on public.lead_signal_events (person_id, occurred_at desc);

create index if not exists idx_lead_identity_person on public.lead_identity_fragments (person_id);
create index if not exists idx_lead_identity_lookup on public.lead_identity_fragments (fragment_type, fragment_normalized);

create index if not exists idx_lead_intent_signals_owner_time on public.lead_intent_signals (owner_user_id, created_at desc);
create index if not exists idx_lead_intent_signals_person on public.lead_intent_signals (person_id, created_at desc);

create index if not exists idx_lead_recommendations_owner_status on public.lead_recommendations (owner_user_id, status, created_at desc);
create index if not exists idx_lead_recommendations_lead on public.lead_recommendations (lead_id, status, created_at desc);

alter table public.lead_people enable row level security;
alter table public.lead_signal_events enable row level security;
alter table public.lead_identity_fragments enable row level security;
alter table public.lead_intent_signals enable row level security;
alter table public.lead_recommendations enable row level security;

drop trigger if exists trg_lead_people_updated_at on public.lead_people;
create trigger trg_lead_people_updated_at
before update on public.lead_people
for each row
execute function public.set_updated_at();

drop trigger if exists trg_lead_identity_fragments_updated_at on public.lead_identity_fragments;
create trigger trg_lead_identity_fragments_updated_at
before update on public.lead_identity_fragments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_lead_recommendations_updated_at on public.lead_recommendations;
create trigger trg_lead_recommendations_updated_at
before update on public.lead_recommendations
for each row
execute function public.set_updated_at();

-- lead_people policies

drop policy if exists lead_people_select_team_or_owner on public.lead_people;
drop policy if exists lead_people_insert_team_or_owner on public.lead_people;
drop policy if exists lead_people_update_team_or_owner on public.lead_people;
drop policy if exists lead_people_delete_owner_or_adminish on public.lead_people;
drop policy if exists lead_people_select_owner on public.lead_people;
drop policy if exists lead_people_insert_owner on public.lead_people;
drop policy if exists lead_people_update_owner on public.lead_people;
drop policy if exists lead_people_delete_owner on public.lead_people;

create policy lead_people_select_owner on public.lead_people
for select to authenticated
using (owner_user_id = auth.uid());

create policy lead_people_insert_owner on public.lead_people
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy lead_people_update_owner on public.lead_people
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy lead_people_delete_owner on public.lead_people
for delete to authenticated
using (owner_user_id = auth.uid());

-- lead_signal_events policies

drop policy if exists lead_signal_events_select_team_or_owner on public.lead_signal_events;
drop policy if exists lead_signal_events_insert_team_or_owner on public.lead_signal_events;
drop policy if exists lead_signal_events_update_team_or_owner on public.lead_signal_events;
drop policy if exists lead_signal_events_delete_owner_or_adminish on public.lead_signal_events;
drop policy if exists lead_signal_events_select_owner on public.lead_signal_events;
drop policy if exists lead_signal_events_insert_owner on public.lead_signal_events;
drop policy if exists lead_signal_events_update_owner on public.lead_signal_events;
drop policy if exists lead_signal_events_delete_owner on public.lead_signal_events;

create policy lead_signal_events_select_owner on public.lead_signal_events
for select to authenticated
using (owner_user_id = auth.uid());

create policy lead_signal_events_insert_owner on public.lead_signal_events
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy lead_signal_events_update_owner on public.lead_signal_events
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy lead_signal_events_delete_owner on public.lead_signal_events
for delete to authenticated
using (owner_user_id = auth.uid());

-- lead_identity_fragments policies

drop policy if exists lead_identity_fragments_select_team_or_owner on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_insert_team_or_owner on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_update_team_or_owner on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_delete_owner_or_adminish on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_select_owner on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_insert_owner on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_update_owner on public.lead_identity_fragments;
drop policy if exists lead_identity_fragments_delete_owner on public.lead_identity_fragments;

create policy lead_identity_fragments_select_owner on public.lead_identity_fragments
for select to authenticated
using (owner_user_id = auth.uid());

create policy lead_identity_fragments_insert_owner on public.lead_identity_fragments
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy lead_identity_fragments_update_owner on public.lead_identity_fragments
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy lead_identity_fragments_delete_owner on public.lead_identity_fragments
for delete to authenticated
using (owner_user_id = auth.uid());

-- lead_intent_signals policies

drop policy if exists lead_intent_signals_select_team_or_owner on public.lead_intent_signals;
drop policy if exists lead_intent_signals_insert_team_or_owner on public.lead_intent_signals;
drop policy if exists lead_intent_signals_update_team_or_owner on public.lead_intent_signals;
drop policy if exists lead_intent_signals_delete_owner_or_adminish on public.lead_intent_signals;
drop policy if exists lead_intent_signals_select_owner on public.lead_intent_signals;
drop policy if exists lead_intent_signals_insert_owner on public.lead_intent_signals;
drop policy if exists lead_intent_signals_update_owner on public.lead_intent_signals;
drop policy if exists lead_intent_signals_delete_owner on public.lead_intent_signals;

create policy lead_intent_signals_select_owner on public.lead_intent_signals
for select to authenticated
using (owner_user_id = auth.uid());

create policy lead_intent_signals_insert_owner on public.lead_intent_signals
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy lead_intent_signals_update_owner on public.lead_intent_signals
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy lead_intent_signals_delete_owner on public.lead_intent_signals
for delete to authenticated
using (owner_user_id = auth.uid());

-- lead_recommendations policies

drop policy if exists lead_recommendations_select_team_or_owner on public.lead_recommendations;
drop policy if exists lead_recommendations_insert_team_or_owner on public.lead_recommendations;
drop policy if exists lead_recommendations_update_team_or_owner on public.lead_recommendations;
drop policy if exists lead_recommendations_delete_owner_or_adminish on public.lead_recommendations;
drop policy if exists lead_recommendations_select_owner on public.lead_recommendations;
drop policy if exists lead_recommendations_insert_owner on public.lead_recommendations;
drop policy if exists lead_recommendations_update_owner on public.lead_recommendations;
drop policy if exists lead_recommendations_delete_owner on public.lead_recommendations;

create policy lead_recommendations_select_owner on public.lead_recommendations
for select to authenticated
using (owner_user_id = auth.uid());

create policy lead_recommendations_insert_owner on public.lead_recommendations
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy lead_recommendations_update_owner on public.lead_recommendations
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy lead_recommendations_delete_owner on public.lead_recommendations
for delete to authenticated
using (owner_user_id = auth.uid());

commit;
