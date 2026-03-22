#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
WEBHOOK_URL="${BASE_URL%/}/api/receptionist/webhook"
AGENT_ID="${AGENT_ID:-${INTAKE_AGENT_ID:-}}"
SECRET="${RECEPTIONIST_WEBHOOK_SECRET:-}"

if [[ -z "${AGENT_ID}" ]]; then
  echo "Missing AGENT_ID (or INTAKE_AGENT_ID)." >&2
  exit 1
fi

if [[ -z "${SECRET}" ]]; then
  echo "Missing RECEPTIONIST_WEBHOOK_SECRET." >&2
  exit 1
fi

STAMP="$(date +%s)"
PHONE="+1555000${STAMP: -4}"

echo "==> SMS inbound"
curl -sS -X POST "${WEBHOOK_URL}" \
  -H "content-type: application/json" \
  -H "x-receptionist-secret: ${SECRET}" \
  -d "{\"event_type\":\"sms_inbound\",\"agent_id\":\"${AGENT_ID}\",\"from_phone\":\"${PHONE}\",\"to_phone\":\"+15551112222\",\"message_body\":\"Need to buy this week in Austin around 650k. call me ASAP\",\"provider\":\"mock\",\"provider_message_id\":\"SM_${STAMP}\"}"
echo
echo

echo "==> Missed call"
curl -sS -X POST "${WEBHOOK_URL}" \
  -H "content-type: application/json" \
  -H "x-receptionist-secret: ${SECRET}" \
  -d "{\"event_type\":\"missed_call\",\"agent_id\":\"${AGENT_ID}\",\"from_phone\":\"${PHONE}\",\"to_phone\":\"+15551112222\",\"provider\":\"mock\",\"provider_call_id\":\"CA_MISSED_${STAMP}\"}"
echo
echo

echo "==> Inbound call log"
curl -sS -X POST "${WEBHOOK_URL}" \
  -H "content-type: application/json" \
  -H "x-receptionist-secret: ${SECRET}" \
  -d "{\"event_type\":\"call_inbound\",\"agent_id\":\"${AGENT_ID}\",\"from_phone\":\"${PHONE}\",\"to_phone\":\"+15551112222\",\"call_status\":\"completed\",\"transcript\":\"I am ready now and need a tour this week\",\"provider\":\"mock\",\"provider_call_id\":\"CA_IN_${STAMP}\"}"
echo
echo

echo "Done. Open /app/list and inspect this lead's communication thread."
