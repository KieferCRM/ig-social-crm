# Meta Step 3: Production Hardening + Validation

## Required Environment Variables
Set these in the runtime environment before using production webhook/OAuth paths.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_TOKEN_ENCRYPTION_KEY` (recommended)
- `META_REDIRECT_URI` (optional override)
- `META_WEBHOOK_DEV_HEADER_ENABLED` (optional, default enabled in non-production)

## Security Behavior
- Production (`NODE_ENV=production`):
  - `POST /api/meta/webhook` requires valid `x-hub-signature-256`.
  - `x-agent-id` dev header path is disabled.
- Non-production:
  - `x-agent-id` dev header path is allowed for local simulation (unless explicitly disabled).

## Idempotency + Replay Safety
- `messages` uniqueness on `(agent_id, meta_message_id)` prevents duplicate inserts.
- Duplicate message events are treated as deduped and do not refresh lead/conversation timestamps.
- Safe retries are supported because upsert/ignore-duplicate semantics are used.

## Validation Steps
1. Start app:
   - `npm run dev`
2. Meta connect start route:
   - `curl -i -X POST http://localhost:3000/api/meta/connect/start`
   - Expect: `200` + JSON with `connect_url`.
3. Webhook verify handshake:
   - `curl -i "http://localhost:3000/api/meta/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=12345"`
   - Expect: `200` body `12345`.
4. Dev webhook replay test (local):
   - `AGENT_ID="<uuid>" bash scripts/test_meta_webhook.sh`
   - Expect: first insert normal, second request marked deduped or no new message id.

## Real Event Validation (Meta)
- Configure Meta app webhook callback URL to `/api/meta/webhook`.
- Use verify token = `META_WEBHOOK_VERIFY_TOKEN`.
- Send/receive a real DM to connected asset.
- Confirm inserts in:
  - `public.conversations`
  - `public.messages`
  - `public.leads`
