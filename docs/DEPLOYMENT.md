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
- [ ] `RECEPTIONIST_PROVIDER` (`mock` or `twilio`)
- [ ] `RECEPTIONIST_WEBHOOK_SECRET`

If ManyChat is enabled:
- [ ] `FEATURE_MANYCHAT_ENABLED=true`
- [ ] `MANYCHAT_WEBHOOK_SECRET`
- [ ] `MANYCHAT_AGENT_ID` (UUID)

If Twilio provider is enabled:
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`

## 3) Supabase Setup
- [ ] Run SQL migrations through:
  - `docs/sql/v4_step20_lead_intelligence_foundation.sql`
  - `docs/sql/v4_step21_ingest_idempotency.sql`
  - `docs/sql/v4_step22_p0_ingestion_contract.sql`
  - `docs/sql/v4_step23_p0_ops_bootstrap_and_checks.sql`
  - `docs/sql/v4_step24_follow_up_reminders_solo_compat.sql`
  - `docs/sql/v4_step27_lead_deal_commission_fields.sql`
  - `docs/sql/v4_step28_receptionist_v1.sql`
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

- [ ] Receptionist webhook + threading smoke:

```bash
AGENT_ID=<auth-user-uuid> \
RECEPTIONIST_WEBHOOK_SECRET=<secret> \
SMOKE_BASE_URL=http://127.0.0.1:3001 \
npm run smoke:receptionist
```

## 5) Post-Deploy Validation
- [ ] Auth login/logout/session persistence works on production domain.
- [ ] Questionnaire intake (`/intake`) inserts and then updates same lead on repeat submit.
- [ ] FUB CSV import (`/app/import`) shows expected inserted/updated/skipped/errors.
- [ ] Kanban stage moves persist (`New`, `Contacted`, `Qualified`, `Closed`).
- [ ] Reminder create + complete flow works.
- [ ] Call/Text actions from lead details are enabled when receptionist settings + phone data exist.
- [ ] Inbound SMS and missed-call webhook events create/update leads and log `lead_interactions`.
- [ ] `GET /api/health` is 200 and no stuck/DLQ ingestion alerts.
