# Receptionist Go-Live Runbook

This checklist assumes SQL migration `v4_step28_receptionist_v1.sql` has already been applied.

## 1) Environment Setup
Add to `.env.local` (and production env later):

```bash
# Required for webhook auth testing (shared-secret path)
RECEPTIONIST_WEBHOOK_SECRET=change-this-long-random-secret

# Provider mode (safe local default)
RECEPTIONIST_PROVIDER=mock

# Agent fallback routing for public/webhook intake
INTAKE_AGENT_ID=<agent-uuid>
```

Optional for Twilio live mode:

```bash
RECEPTIONIST_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
```

## 2) Configure Receptionist Settings in CRM
Open:
- `/app/settings/receptionist`

Set:
- `Receptionist Enabled` = on
- `Communications Enabled` = on
- `Missed-call Text-back` = on
- `Business Phone Number`
- `Forwarding Phone Number`
- `Notification Phone Number` (optional)
- office hours / after-hours behavior

## 3) Local Replay Checks
Use the built-in replay script:

```bash
AGENT_ID=<agent-uuid> \
RECEPTIONIST_WEBHOOK_SECRET=<secret> \
BASE_URL=http://127.0.0.1:3001 \
./scripts/receptionist_webhook_examples.sh
```

This sends:
- `sms_inbound`
- `missed_call`
- `call_inbound`

## 4) Mock End-to-End Smoke Validation
Requires:
- local app running
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENT_ID` (or `INTAKE_AGENT_ID`)
- `RECEPTIONIST_WEBHOOK_SECRET`

Run:

```bash
npm run smoke:receptionist
```

Validates:
- lead upsert by phone
- interaction logging in `lead_interactions`
- missed-call workflow logs
- urgency detection on call transcript
- alert creation in `receptionist_alerts`

## 5) Twilio Webhook Wiring (Production)
Webhook endpoint:
- `POST /api/receptionist/webhook`

Supported payloads now:
- JSON payloads (shared-secret auth)
- Twilio form-encoded payloads (Twilio signature validation)

Auth behavior:
- If `x-twilio-signature` header is present, signature is validated against `TWILIO_AUTH_TOKEN`.
- Shared-secret (`x-receptionist-secret`) remains supported for custom bridges/test tools.

Recommended production setup:
- keep `RECEPTIONIST_WEBHOOK_SECRET` set
- configure Twilio webhooks directly to `/api/receptionist/webhook`
- use HTTPS origin only

## 6) Quick DB Verification Queries
```sql
select id, full_name, canonical_phone, urgency_level, urgency_score, last_communication_at
from public.leads
order by last_communication_at desc nulls last
limit 20;

select channel, direction, interaction_type, status, created_at
from public.lead_interactions
order by created_at desc
limit 40;

select severity, alert_type, status, created_at
from public.receptionist_alerts
order by created_at desc
limit 40;
```

## 7) Safety Notes
- No webapp deployment is performed by these local scripts.
- Receptionist APIs reuse the existing lead model and agent scoping.
- If provider wiring is incomplete, mock mode still logs complete CRM-side flows.
