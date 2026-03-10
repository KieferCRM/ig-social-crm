-- V4 Step 23: P0 ops bootstrap + verification checks
-- Run after v4_step22 has been applied successfully.

begin;

-- Replace this value with your own auth.users.id before running.
-- Example: '11111111-2222-4333-8444-555555555555'
-- If you already have an agents row, this upsert is safe.
insert into public.agents (id, email, full_name, plan)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', '')
  ) as full_name,
  'free'
from auth.users u
where u.id = 'REPLACE_WITH_AUTH_USER_ID'::uuid
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.agents.full_name);

commit;

-- ================================
-- Post-migration verification queries
-- ================================

-- 1) Confirm P0 tables exist
select
  to_regclass('public.agents') as agents_table,
  to_regclass('public.ingestion_events') as ingestion_events_table,
  to_regclass('public.lead_events') as lead_events_table;

-- 2) Confirm required consent columns on leads
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leads'
  and column_name in (
    'agent_id',
    'canonical_email',
    'canonical_phone',
    'source_ref_id',
    'consent_to_email',
    'consent_to_sms',
    'consent_source',
    'consent_timestamp',
    'consent_text_snapshot',
    'deleted_at'
  )
order by column_name;

-- 3) Confirm idempotency index exists
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'ingestion_events'
  and indexname = 'idx_ingestion_events_idempotency';

-- 4) Queue health snapshot
select status, count(*) as total
from public.ingestion_events
group by status
order by status;

-- 5) Stuck events (>5 minutes old)
select count(*) as received_older_than_5m
from public.ingestion_events
where status = 'received'
  and created_at < now() - interval '5 minutes';

-- 6) Recent timeline activity
select lead_id, event_type, created_at
from public.lead_events
order by created_at desc
limit 20;
