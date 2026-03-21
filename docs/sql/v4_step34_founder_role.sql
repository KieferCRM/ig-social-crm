-- v4_step34_founder_role.sql
--
-- Adds a `role` column to the agents table for app-level roles.
-- The `founder` role bypasses all billing tier restrictions in checkAgentTier().
--
-- Roles:
--   agent   — default, standard access gated by billing_tier
--   founder — full access to all tiers and features, no Stripe subscription needed
--   admin   — reserved for future internal admin use
--
-- Run this in Supabase SQL Editor, then run the UPDATE below with your UUID.

begin;

alter table public.agents
  add column if not exists role text not null default 'agent'
    check (role in ('agent', 'founder', 'admin'));

-- ============================================================
-- After running the above, run this UPDATE with your own UUID:
--
-- update public.agents
-- set
--   role = 'founder',
--   billing_tier = 'secretary_voice',
--   settings = settings || jsonb_build_object(
--     'receptionist_settings',
--     coalesce(settings->'receptionist_settings', '{}'::jsonb)
--       || '{"voice_tier":"voice","receptionist_enabled":true,"communications_enabled":true}'::jsonb
--   ),
--   updated_at = now()
-- where id = '<YOUR-UUID-HERE>';
--
-- Replace <YOUR-UUID-HERE> with your id from the agents table.
-- ============================================================

commit;
