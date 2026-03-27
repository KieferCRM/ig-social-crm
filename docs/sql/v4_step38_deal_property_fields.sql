-- =============================================================================
-- v4_step38_deal_property_fields.sql
-- Adds acreage, mls_number, and parcel_id to deals table
-- =============================================================================

begin;

alter table public.deals
  add column if not exists acreage numeric(10, 2),
  add column if not exists mls_number text,
  add column if not exists parcel_id text;

commit;

-- Verification:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'deals'
--   AND column_name IN ('acreage', 'mls_number', 'parcel_id');
