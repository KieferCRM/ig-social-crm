-- =============================================================================
-- v4_step33_billing_columns.sql
-- Stripe billing columns for agents table
-- =============================================================================
-- Adds 4 columns to support Stripe subscription management:
--   stripe_customer_id       — Stripe Customer ID (cus_...)
--   stripe_subscription_id   — Active subscription ID (sub_...)
--   stripe_subscription_status — Stripe subscription status string
--   billing_tier             — Feature access tier (drives voice_tier in sync)
--
-- All existing agents default to billing_tier = 'core_crm'. No data backfill needed.
-- Tier <-> voice_tier sync is handled automatically by the Stripe webhook handler.
-- =============================================================================

begin;

alter table public.agents
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists billing_tier text not null default 'core_crm';

-- Enforce valid billing_tier values
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agents_billing_tier_check'
      and conrelid = 'public.agents'::regclass
  ) then
    alter table public.agents
      add constraint agents_billing_tier_check
      check (billing_tier in ('core_crm', 'secretary_sms', 'secretary_voice'));
  end if;
end $$;

-- Enforce valid subscription status values (mirrors Stripe's known statuses)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agents_stripe_subscription_status_check'
      and conrelid = 'public.agents'::regclass
  ) then
    alter table public.agents
      add constraint agents_stripe_subscription_status_check
      check (
        stripe_subscription_status is null or
        stripe_subscription_status in (
          'active', 'past_due', 'canceled', 'unpaid',
          'trialing', 'incomplete', 'incomplete_expired', 'paused'
        )
      );
  end if;
end $$;

-- Lookup index for Stripe customer ID (used in webhook to resolve agent)
create unique index if not exists idx_agents_stripe_customer_id
  on public.agents (stripe_customer_id)
  where stripe_customer_id is not null;

-- Lookup index for subscription ID
create unique index if not exists idx_agents_stripe_subscription_id
  on public.agents (stripe_subscription_id)
  where stripe_subscription_id is not null;

commit;

-- =============================================================================
-- Billing Tier Values
-- =============================================================================
-- 'core_crm'        — Full CRM, no Secretary features
-- 'secretary_sms'   — Core + SMS lead qualification, missed call textback, alerts
-- 'secretary_voice' — Secretary SMS + AI voice answering, transcription, voice cloning add-on
--
-- voice_tier in agents.settings->receptionist_settings is kept in sync automatically:
--   core_crm        → voice_tier: 'none'
--   secretary_sms   → voice_tier: 'sms'
--   secretary_voice → voice_tier: 'voice'
--
-- =============================================================================
-- Verification Queries
-- =============================================================================
--
-- Confirm columns added:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'agents'
--     AND column_name IN ('stripe_customer_id','stripe_subscription_id',
--                         'stripe_subscription_status','billing_tier');
--
-- Confirm all existing agents on core_crm:
--   SELECT COUNT(*) FROM agents WHERE billing_tier != 'core_crm';
--   -- Expected: 0
