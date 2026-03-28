-- =============================================================================
-- v5_step05_traditional_agent_upgrade.sql
-- Traditional agent (solo_agent) pipeline upgrade
--
-- Changes:
--   1. Drop old deals_stage_check constraint (missing new traditional stages)
--   2. Add all new buyer + listing stages to constraint
--   3. Add deal_details JSONB column for type-specific fields
--   4. Create deal_checklist_items table
-- =============================================================================

begin;

-- ── 1. Expand deal stage constraint ──────────────────────────────────────────

alter table public.deals
  drop constraint if exists deals_stage_check;

alter table public.deals
  add constraint deals_stage_check
  check (
    stage in (
      -- traditional shared
      'new', 'showing', 'offer_made', 'under_contract',
      'inspection', 'appraisal', 'closing', 'closed', 'lost', 'past_client',
      -- buyer pipeline
      'contacted', 'qualified', 'buyer_consultation', 'active_search',
      -- listing pipeline
      'listing_appointment', 'agreement_signed', 'active_listing',
      -- off-market (preserved)
      'prospecting', 'offer_sent', 'negotiating', 'dead'
    )
  );

-- ── 2. Add deal_details JSONB column ─────────────────────────────────────────

alter table public.deals
  add column if not exists deal_details jsonb default '{}';

-- ── 3. Create deal_checklist_items table ─────────────────────────────────────

create table if not exists public.deal_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  agent_id     uuid not null references auth.users(id) on delete cascade,
  label        text not null,
  completed    boolean not null default false,
  completed_at timestamptz,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_checklist_deal_id
  on public.deal_checklist_items (deal_id);

create index if not exists idx_checklist_agent_deal
  on public.deal_checklist_items (agent_id, deal_id);

-- RLS
alter table public.deal_checklist_items enable row level security;

create policy "agent owns checklist items"
  on public.deal_checklist_items
  for all
  using (agent_id = auth.uid());

notify pgrst, 'reload schema';

commit;

-- Verification:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'deal_details';
-- SELECT COUNT(*) FROM deal_checklist_items;
