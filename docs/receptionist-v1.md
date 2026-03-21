# LockboxHQ Receptionist V1

LockboxHQ Receptionist V1 adds a phone/SMS intake channel that writes to the same `leads` model used by questionnaire intake.

## What Was Built
- **Schema migration**: [`docs/sql/v4_step28_receptionist_v1.sql`](./sql/v4_step28_receptionist_v1.sql)
  - `lead_interactions` table for SMS/call/system communication history
  - `receptionist_alerts` table for internal app alerts
  - `leads` extensions: `urgency_level`, `urgency_score`, `last_communication_at`
  - indexes + RLS policies aligned to `agent_id = auth.uid()`
- **Service layer**:
  - `src/lib/receptionist/settings.ts`
  - `src/lib/receptionist/urgency.ts`
  - `src/lib/receptionist/lead-upsert.ts`
  - `src/lib/receptionist/provider.ts`
  - `src/lib/receptionist/service.ts`
- **API routes**:
  - `GET/POST /api/receptionist/settings`
  - `GET /api/receptionist/threads/[leadId]`
  - `POST /api/receptionist/threads/[leadId]/messages`
  - `POST /api/receptionist/call`
  - `POST /api/receptionist/webhook`
- **UI updates**:
  - Lead workspace popup now has native communications block (thread history, send SMS, click-to-call)
  - CRM `Call` and `Text` actions now route through receptionist APIs (not device `tel:`/`sms:` links)
  - Open receptionist alerts shown in lead workspace
  - New settings page: `/app/settings/receptionist`
  - Settings hub card links to receptionist settings

## Shared Lead Model Alignment
Receptionist upsert/dedupe behavior:
1. Match by `agent_id + canonical_phone`
2. Fallback match by `agent_id + canonical_email`
3. If found: append interactions, fill missing lead fields, preserve stronger existing data
4. If not found: create a lead in the same `leads` table

Receptionist updates these existing lead fields when available:
- `full_name`, `canonical_phone`, `canonical_email`
- `intent`, `timeline`, `budget_range`, `location_area`
- `contact_preference`, `notes`, `next_step`
- `source` values like `sms_receptionist`, `missed_call_textback`, `call_inbound`

## Channel Flows
### 1) Missed-call text-back
- Webhook: `event_type = "missed_call"`
- Logs missed call interaction
- Upserts lead by phone
- Sends auto text-back (when enabled and configured)
- Logs outbound text-back message in `lead_interactions`

### 2) Inbound SMS qualification
- Webhook: `event_type = "sms_inbound"`
- Upserts lead by phone/email
- Parses message for structured fields (intent/timeline/budget/location/email/contact preference)
- Detects urgency keywords and updates lead urgency
- Logs inbound SMS
- Sends next-best qualification question when receptionist comms are enabled

### 3) Outbound SMS from CRM
- UI action from lead popup -> `POST /api/receptionist/threads/[leadId]/messages`
- Sends SMS from business number
- Logs outbound interaction
- Delivery status/provider metadata saved

### 4) Click-to-call bridge from CRM
- UI action from lead popup -> `POST /api/receptionist/call`
- V1 bridge flow: call forwarding phone first, then dial lead
- Logs call attempt/status/provider call ID

## Urgency + Alerts
Rule-based urgency checks include keywords such as:
- `today`, `asap`, `this week`, `ready now`, `call me`, `tour`, `offer`

When triggered, V1:
- raises `leads.urgency_level` / `leads.urgency_score`
- writes to `receptionist_alerts`
- surfaces active alerts in lead workspace communications panel

## Mocked vs Real Provider Behavior
Provider abstraction: `src/lib/receptionist/provider.ts`

### Mock mode (default)
- `RECEPTIONIST_PROVIDER=mock` (or unset)
- SMS/call responses are simulated and logged
- Safe for local development

### Twilio mode (wired)
- `RECEPTIONIST_PROVIDER=twilio`
- Uses Twilio REST APIs for:
  - SMS send
  - outbound call bridge initiation
- Required env vars:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`

## Webhook Contract (V1)
Endpoint: `POST /api/receptionist/webhook`

Headers:
- optional `x-receptionist-secret` (required only if `RECEPTIONIST_WEBHOOK_SECRET` is set)

Body:
- `event_type`: `sms_inbound` | `missed_call` | `call_inbound`
- `agent_id` (optional if `INTAKE_AGENT_ID` is configured)
- `from_phone` (required)
- optional: `to_phone`, `message_body`, `transcript`, `provider`, `provider_message_id`, `provider_call_id`, `call_status`

Twilio compatibility:
- accepts standard Twilio `application/x-www-form-urlencoded` webhooks
- maps `From`/`To`/`Body`/`MessageSid`/`CallSid`/`CallStatus` payloads into receptionist events
- validates `x-twilio-signature` when present using `TWILIO_AUTH_TOKEN`

Operational checklist:
- see [`docs/receptionist-go-live.md`](./receptionist-go-live.md)

## Remaining Integration Tasks
- Connect telephony provider webhooks to `POST /api/receptionist/webhook`
- Add provider-specific webhook signature verification (currently shared-secret based)
- If running multi-number/multi-agent routing, add phone-number-to-agent resolution
- Add delivery status callbacks (optional) to update outbound SMS status from `queued/sent` to `delivered/failed`

## Recommended Next Step For Future Live Voice
Add a **voice session adapter** that writes every voice event into `lead_interactions` with `channel = "voice"`, then reuse the same urgency, alerting, and lead-upsert pipeline already in V1.
