-- =============================================================================
-- v5_step06_deal_events.sql
-- Deal timeline event log
--
-- Creates deal_events table for tracking the full history of a deal:
--   form submissions, calls, SMS, emails, documents, stage changes.
--
-- Written to from all three intake channels (Forms, Secretary, Inbox)
-- via the shared writeDealEvent helper in src/lib/crm-events.ts.
-- =============================================================================

begin;

-- ── deal_events table ─────────────────────────────────────────────────────────

create table if not exists public.deal_events (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deals(id) on delete cascade,
  agent_id        uuid not null,
  event_type      text not null,
  source_channel  text,
  summary         text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- Index for the most common access pattern: timeline for a single deal
create index if not exists deal_events_deal_id_created_at_idx
  on public.deal_events (deal_id, created_at desc);

-- Index for agent-scoped queries (e.g. "all events today across my deals")
create index if not exists deal_events_agent_id_created_at_idx
  on public.deal_events (agent_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.deal_events enable row level security;

-- Agents can read their own deal events
create policy "agent_read_deal_events"
  on public.deal_events for select
  using (agent_id = auth.uid());

-- Agents can insert their own deal events
create policy "agent_insert_deal_events"
  on public.deal_events for insert
  with check (agent_id = auth.uid());

-- Service role (used by admin client) bypasses RLS — no extra policy needed

commit;
