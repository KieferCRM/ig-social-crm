#!/usr/bin/env bash
# Usage:
# AGENT_ID="<uuid>" bash scripts/test_meta_webhook.sh

set -euo pipefail

WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3000/api/meta/webhook}"
META_WEBHOOK_DEV_HEADER_ENABLED="${META_WEBHOOK_DEV_HEADER_ENABLED:-false}"
WEBHOOK_HOST="$(echo "$WEBHOOK_URL" | sed -E 's#^https?://([^/:]+).*$#\\1#')"

if [[ -z "${AGENT_ID:-}" ]]; then
  echo "ERROR: AGENT_ID is required."
  echo "Example: AGENT_ID=\"<uuid>\" bash scripts/test_meta_webhook.sh"
  exit 1
fi

if [[ "$META_WEBHOOK_DEV_HEADER_ENABLED" != "true" ]]; then
  echo "ERROR: META_WEBHOOK_DEV_HEADER_ENABLED must be true for this local test."
  echo "Example: META_WEBHOOK_DEV_HEADER_ENABLED=true AGENT_ID=\"<uuid>\" bash scripts/test_meta_webhook.sh"
  exit 1
fi

if [[ "$WEBHOOK_HOST" != "localhost" && "$WEBHOOK_HOST" != "127.0.0.1" ]]; then
  echo "ERROR: WEBHOOK_URL must point to localhost/127.0.0.1 for dev impersonation mode."
  exit 1
fi

THREAD_ID="t_123"
MESSAGE_ID="m_123"
NOW_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

PAYLOAD="{\"platform\":\"ig\",\"meta_thread_id\":\"$THREAD_ID\",\"meta_message_id\":\"$MESSAGE_ID\",\"meta_participant_id\":\"demo_user\",\"direction\":\"in\",\"text\":\"hello\",\"ts\":\"$NOW_TS\",\"raw\":{\"sample\":true}}"

post_once() {
  local name="$1"
  local body
  local code

  body="$(mktemp)"
  code="$(curl -sS -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-agent-id: $AGENT_ID" \
    -d "$PAYLOAD" \
    -o "$body" \
    -w "%{http_code}")"

  echo "$name -> HTTP $code"
  cat "$body"
  echo
  rm -f "$body"
}

echo "Attempt 1 (insert expected)"
post_once "Attempt 1"

echo "Attempt 2 (dedupe expected for message)"
post_once "Attempt 2"
