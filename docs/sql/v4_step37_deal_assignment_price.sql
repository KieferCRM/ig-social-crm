-- =============================================================================
-- v4_step37_deal_assignment_price.sql
-- Adds assignment_price column to deals for B-C contract tracking
-- =============================================================================
-- assignment_price = price agent assigns to buyer (B-C contract)
-- offer_price      = price agent agreed with seller (A-B contract)
-- spread           = assignment_price - offer_price (calculated in UI)
-- =============================================================================

begin;

alter table public.deals
  add column if not exists assignment_price numeric(14, 2);

commit;

-- Verification:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'deals' AND column_name = 'assignment_price';
