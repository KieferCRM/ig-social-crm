#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4010}"
SOURCE="${SOURCE:-smoke}"
AGENT_ID="${AGENT_ID:-}"
INGEST_SECRET="${INGEST_WEBHOOK_SECRET:-}"
PROCESSOR_SECRET="${INGEST_PROCESSOR_SECRET:-}"
EXTERNAL_EVENT_ID="${EXTERNAL_EVENT_ID:-smoke-$(date +%s)}"

if [[ -z "${AGENT_ID}" ]]; then
  echo "Missing AGENT_ID." >&2
  echo "Usage: AGENT_ID=<auth-user-uuid> INGEST_WEBHOOK_SECRET=... INGEST_PROCESSOR_SECRET=... ./scripts/smoke_ingest.sh" >&2
  exit 1
fi

if [[ -z "${INGEST_SECRET}" ]]; then
  echo "Missing INGEST_WEBHOOK_SECRET." >&2
  exit 1
fi

if [[ -z "${PROCESSOR_SECRET}" ]]; then
  echo "Missing INGEST_PROCESSOR_SECRET." >&2
  exit 1
fi

INGEST_URL="${BASE_URL%/}/api/ingest/${SOURCE}"
PROCESS_URL="${BASE_URL%/}/api/ingest/process?limit=50"
NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TS="$(date +%s)"
HANDLE_SUFFIX="$(echo "${EXTERNAL_EVENT_ID}" | tr -cd 'a-zA-Z0-9' | tail -c 9)"

RAW_PAYLOAD="$(cat <<JSON
{
  "external_event_id": "${EXTERNAL_EVENT_ID}",
  "event_type": "ingested",
  "occurred_at": "${NOW_ISO}",
  "source_ref_id": "${EXTERNAL_EVENT_ID}",
  "lead": {
    "ig_username": "smoke_${HANDLE_SUFFIX}",
    "email": "smoke+${HANDLE_SUFFIX}@example.com",
    "phone": "+1555555${RANDOM}",
    "first_name": "Smoke",
    "last_name": "Lead",
    "stage": "New",
    "tags": ["smoke", "p0"],
    "custom_fields": {
      "channel": "webhook",
      "campaign": "p0_validation"
    },
    "consent_to_email": true,
    "consent_to_sms": false,
    "consent_source": "smoke_ingest.sh",
    "consent_timestamp": "${NOW_ISO}",
    "consent_text_snapshot": "I agree to receive email updates."
  }
}
JSON
)"

SIGNING_STRING="${TS}.${RAW_PAYLOAD}"
SIG_HEX="$(printf "%s" "${SIGNING_STRING}" | openssl dgst -sha256 -hmac "${INGEST_SECRET}" -binary | xxd -p -c 256)"

echo "==> POST ${INGEST_URL}"
curl -sS -X POST "${INGEST_URL}" \
  -H "content-type: application/json" \
  -H "x-agent-id: ${AGENT_ID}" \
  -H "x-ingest-timestamp: ${TS}" \
  -H "x-ingest-signature: sha256=${SIG_HEX}" \
  -d "${RAW_PAYLOAD}"
echo

echo "==> POST ${PROCESS_URL}"
curl -sS -X POST "${PROCESS_URL}" \
  -H "x-ingest-processor-secret: ${PROCESSOR_SECRET}"
echo

echo "Done. Validate in Supabase:"
echo "  select status, count(*) from public.ingestion_events group by status order by status;"
echo "  select event_type, created_at from public.lead_events order by created_at desc limit 10;"
