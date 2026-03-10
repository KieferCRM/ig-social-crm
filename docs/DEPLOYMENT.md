# IG Social CRM Deployment Checklist (Solo, No Meta)

## 1) Vercel Setup
- [ ] Connect the Git repository in Vercel.
- [ ] Set project root to repo root.
- [ ] Build command: `next build`.
- [ ] Deploy preview first; promote to production only after validation passes.

## 2) Required Environment Variables (Production)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL` (`https://...`)
- [ ] `INTAKE_AGENT_ID` (UUID)
- [ ] `INGEST_WEBHOOK_SECRET`
- [ ] `INGEST_PROCESSOR_SECRET`
- [ ] `RATE_LIMIT_REDIS_REST_URL` (`https://...`)
- [ ] `RATE_LIMIT_REDIS_REST_TOKEN`

If ManyChat is enabled:
- [ ] `FEATURE_MANYCHAT_ENABLED=true`
- [ ] `MANYCHAT_WEBHOOK_SECRET`
- [ ] `MANYCHAT_AGENT_ID` (UUID)

## 3) Supabase Setup
- [ ] Run SQL migrations through:
  - `docs/sql/v4_step20_lead_intelligence_foundation.sql`
  - `docs/sql/v4_step21_ingest_idempotency.sql`
  - `docs/sql/v4_step22_p0_ingestion_contract.sql`
  - `docs/sql/v4_step23_p0_ops_bootstrap_and_checks.sql`
  - `docs/sql/v4_step24_follow_up_reminders_solo_compat.sql`
- [ ] Replace `REPLACE_WITH_AUTH_USER_ID` in step 23 before execution.
- [ ] Confirm Auth Site URL + redirects match production domain.

## 4) Pre-Deploy Gates
- [ ] `npm run release:check`
- [ ] `npm run release:check:with-smoke`
- [ ] Generic ingest smoke:

```bash
AGENT_ID=<auth-user-uuid> \
INGEST_WEBHOOK_SECRET=<webhook-secret> \
INGEST_PROCESSOR_SECRET=<processor-secret> \
./scripts/smoke_ingest.sh
```

## 5) Post-Deploy Validation
- [ ] Auth login/logout/session persistence works on production domain.
- [ ] Questionnaire intake (`/intake`) inserts and then updates same lead on repeat submit.
- [ ] FUB CSV import (`/app/import`) shows expected inserted/updated/skipped/errors.
- [ ] Kanban stage moves persist (`New`, `Contacted`, `Qualified`, `Closed`).
- [ ] Reminder create + complete flow works.
- [ ] `GET /api/health` is 200 and no stuck/DLQ ingestion alerts.
