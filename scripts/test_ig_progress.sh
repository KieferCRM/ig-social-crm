#!/usr/bin/env bash
# Usage:
# IG_PROGRESS_URL="https://your-project.supabase.co/functions/v1/ig_progress" \
# IG_INGEST_SECRET="your-secret" \
# IG_AGENT_EMAIL="you@example.com" \
# bash scripts/test_ig_progress.sh

set -euo pipefail

if [[ -z "${IG_PROGRESS_URL:-}" ]]; then
  echo "ERROR: IG_PROGRESS_URL is required."
  echo "Example: IG_PROGRESS_URL=\"https://your-project.supabase.co/functions/v1/ig_progress\" IG_INGEST_SECRET=\"...\" bash scripts/test_ig_progress.sh"
  exit 1
fi

if [[ -z "${IG_INGEST_SECRET:-}" ]]; then
  echo "ERROR: IG_INGEST_SECRET is required."
  echo "Example: IG_PROGRESS_URL=\"https://your-project.supabase.co/functions/v1/ig_progress\" IG_INGEST_SECRET=\"...\" bash scripts/test_ig_progress.sh"
  exit 1
fi

if [[ -z "${IG_AGENT_EMAIL:-}" ]]; then
  echo "ERROR: IG_AGENT_EMAIL is required."
  echo "Example: IG_AGENT_EMAIL=\"you@example.com\" IG_PROGRESS_URL=\"...\" IG_INGEST_SECRET=\"...\" bash scripts/test_ig_progress.sh"
  exit 1
fi

run_test() {
  local name="$1"
  local payload="$2"

  local body_file
  body_file="$(mktemp)"

  local http_code
  http_code="$(curl -sS -X POST "$IG_PROGRESS_URL" \
    -H "Content-Type: application/json" \
    -H "x-ingest-secret: $IG_INGEST_SECRET" \
    -d "$payload" \
    -o "$body_file" \
    -w "%{http_code}")"

  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    echo "PASS: ${name} (HTTP ${http_code})"
    echo "Response:"
    cat "$body_file"
    echo
  else
    echo "FAIL: ${name} (HTTP ${http_code})"
    echo "Response:"
    cat "$body_file"
    echo
    rm -f "$body_file"
    exit 1
  fi

  rm -f "$body_file"
}

TEST_A_PAYLOAD="{\"agent_email\":\"$IG_AGENT_EMAIL\",\"ig_username\":\"test_lead_aa11\",\"intent\":\"Initial intent\",\"timeline\":\"Q2\",\"lead_temp\":\"Cold\",\"source\":\"IG DM\",\"notes\":\"Test A insert\",\"stage\":\"New\"}"
TEST_B_PAYLOAD="{\"agent_email\":\"$IG_AGENT_EMAIL\",\"ig_username\":\"test_lead_aa11\",\"intent\":\"Updated intent\",\"timeline\":\"Q2\",\"lead_temp\":\"Warm\",\"source\":\"IG DM\",\"notes\":\"Test B update\",\"stage\":\"New\"}"

echo "Running Test A (insert) against: $IG_PROGRESS_URL"
run_test "Test A: insert" "$TEST_A_PAYLOAD"

echo "Running Test B (update same ig_username) against: $IG_PROGRESS_URL"
run_test "Test B: update" "$TEST_B_PAYLOAD"

echo "Done. Both tests returned 2xx."
