-- V4 Step 21: durable ingest idempotency keys (solo-first)
-- Prevents duplicate signal ingestion across retries/replays per agent+source key.

begin;

create table if not exists public.lead_ingest_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (length(trim(source)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  lead_id uuid references public.leads(id) on delete set null,
  event_id uuid references public.lead_signal_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (agent_id, source, idempotency_key)
);

create index if not exists idx_lead_ingest_keys_owner_time
  on public.lead_ingest_keys (owner_user_id, created_at desc);

create index if not exists idx_lead_ingest_keys_event
  on public.lead_ingest_keys (event_id);

alter table public.lead_ingest_keys enable row level security;

drop trigger if exists trg_lead_ingest_keys_updated_at on public.lead_ingest_keys;
create trigger trg_lead_ingest_keys_updated_at
before update on public.lead_ingest_keys
for each row
execute function public.set_updated_at();

drop policy if exists lead_ingest_keys_select_team_or_owner on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_insert_team_or_owner on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_update_team_or_owner on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_delete_owner_or_adminish on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_select_owner on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_insert_owner on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_update_owner on public.lead_ingest_keys;
drop policy if exists lead_ingest_keys_delete_owner on public.lead_ingest_keys;

create policy lead_ingest_keys_select_owner on public.lead_ingest_keys
for select to authenticated
using (owner_user_id = auth.uid());

create policy lead_ingest_keys_insert_owner on public.lead_ingest_keys
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy lead_ingest_keys_update_owner on public.lead_ingest_keys
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy lead_ingest_keys_delete_owner on public.lead_ingest_keys
for delete to authenticated
using (owner_user_id = auth.uid());

commit;
