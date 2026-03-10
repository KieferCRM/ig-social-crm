-- V2 Step 13: Webhook ingestion observability (failure + retry visibility)

begin;

create table if not exists public.meta_webhook_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('dev','meta')),
  status text not null check (status in ('processed','deduped','failed','ignored')),
  signature_valid boolean,
  meta_message_id text,
  meta_thread_id text,
  meta_participant_id text,
  reason text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_meta_webhook_events_agent_created_at
  on public.meta_webhook_events (agent_id, created_at desc);

create index if not exists idx_meta_webhook_events_status_created_at
  on public.meta_webhook_events (status, created_at desc);

alter table public.meta_webhook_events enable row level security;

drop policy if exists meta_webhook_events_select_own on public.meta_webhook_events;
create policy meta_webhook_events_select_own on public.meta_webhook_events
for select to authenticated
using (agent_id = auth.uid());

commit;
