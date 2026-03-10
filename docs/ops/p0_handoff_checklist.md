# P0 Handoff Checklist (Solo Agent)

This checklist is for the remaining credential-bound steps after code and schema hardening.

## 1) Apply SQL migrations in order
1. `docs/sql/v4_step20_lead_intelligence_foundation.sql`
2. `docs/sql/v4_step21_ingest_idempotency.sql`
3. `docs/sql/v4_step22_p0_ingestion_contract.sql`
4. `docs/sql/v4_step23_p0_ops_bootstrap_and_checks.sql`
5. `docs/sql/v4_step24_follow_up_reminders_solo_compat.sql`

For step 23, replace `REPLACE_WITH_AUTH_USER_ID` with your real `auth.users.id`.

## 2) Set required env vars (`.env.local`)
- `INTAKE_AGENT_ID`
- `INGEST_WEBHOOK_SECRET`
- `INGEST_PROCESSOR_SECRET`
- `RATE_LIMIT_REDIS_REST_URL`
- `RATE_LIMIT_REDIS_REST_TOKEN`

## 3) Run release gates on your machine
```bash
npm run release:check:local
npm run release:check:with-smoke
```

## 4) Run generic ingest smoke
```bash
AGENT_ID=<your-auth-user-uuid> \
INGEST_WEBHOOK_SECRET=<your-webhook-secret> \
INGEST_PROCESSOR_SECRET=<your-processor-secret> \
./scripts/smoke_ingest.sh
```

## 5) Confirm queue + timeline in Supabase SQL editor
```sql
select status, count(*) from public.ingestion_events group by status order by status;
select lead_id, event_type, created_at from public.lead_events order by created_at desc limit 20;
```

## 6) Configure uptime monitor
- Monitor `GET /api/health`
- Alert if:
  - endpoint returns non-200
  - `alerts.has_dlq = true`
  - `alerts.has_stuck_received = true`
