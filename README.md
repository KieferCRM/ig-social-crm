# IG Social CRM

Ingestion-first CRM for real estate agents using Instagram/Facebook DMs as the lead source.

## Core Stack
- Next.js App Router
- Supabase Auth + Postgres
- Supabase SSR clients for middleware/server routes

## Local Development
```bash
npm install
npm run dev
```

## Workspace Mode
- Solo-agent mode only in this release.
- Team workspace routes/modules have been removed from runtime.

## Environment
Minimum required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Production release (`solo-prod`) also requires:
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (must be `https://...`)
- `INTAKE_AGENT_ID` (UUID)
- `MANYCHAT_WEBHOOK_SECRET`
- `MANYCHAT_AGENT_ID` (UUID)
- `INGEST_WEBHOOK_SECRET` (fallback shared secret for generic ingest webhooks)
- `INGEST_PROCESSOR_SECRET` (auth secret for `/api/ingest/process`)
- `RATE_LIMIT_REDIS_REST_URL` (Upstash/Redis REST `https://...`)
- `RATE_LIMIT_REDIS_REST_TOKEN`

Rate limiter backend behavior:
- If Redis REST env vars are set, API/webhook rate limits are enforced in Redis (multi-instance safe).
- If not set, the app falls back to in-memory buckets (dev-only behavior; not production-safe).

Meta flows also require:
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_TOKEN_ENCRYPTION_KEY`

Public intake form (`/intake`) requires:
- `INTAKE_AGENT_ID` (destination user UUID for new submissions)

LockboxHQ Receptionist V1 (SMS/call intake) options:
- `RECEPTIONIST_PROVIDER` (`mock` default, or `twilio`)
- `RECEPTIONIST_WEBHOOK_SECRET` (optional shared secret for `/api/receptionist/webhook`)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` (required only when `RECEPTIONIST_PROVIDER=twilio`)

ManyChat webhook integration requires:
- `MANYCHAT_WEBHOOK_SECRET` (shared secret sent in `x-manychat-secret`)
- `MANYCHAT_AGENT_ID` (destination user UUID for ingested ManyChat events)

Generic ingest webhook (`/api/ingest/[source]`) requires:
- `x-agent-id` (UUID)
- `x-ingest-timestamp` (unix seconds)
- `x-ingest-signature` (`sha256=<hex>` over `${timestamp}.${rawBody}`)
- Agent-specific `agents.webhook_secret` (or fallback `INGEST_WEBHOOK_SECRET`)
- `agents` row keyed by `id = auth.users.id`

`agents` rows are auto-bootstrapped on authenticated API access. You can also seed manually with:
- `docs/sql/v4_step23_p0_ops_bootstrap_and_checks.sql`

Ingestion retry worker endpoint (`/api/ingest/process`) requires:
- `x-ingest-processor-secret` header matching `INGEST_PROCESSOR_SECRET`

Health endpoint for uptime/ops checks:
- `GET /api/health`
- Returns DB health plus ingestion queue counters (`received`, `failed`, `dlq`, `received_older_than_5m`)

## Release Gate
Run before deploy:
```bash
npm run release:check
```

Includes:
1. Env preflight (`solo-prod`)
2. Typecheck
3. Lint
4. Production build

Local release gate (without production-only env requirements):
```bash
npm run release:check:local
```

Full gate including smoke tests:
```bash
npm run release:check:with-smoke
```

### Smoke Suite Prerequisites
`npm run smoke:solo` requires:
- Built app (`next build`) so smoke can auto-start `next start`
- `SMOKE_TEST_EMAIL`
- `SMOKE_TEST_PASSWORD`
- Core Supabase env vars
- `INTAKE_AGENT_ID` (UUID destination for `/api/intake`)
- `SMOKE_BASE_URL` must be localhost (defaults to `http://127.0.0.1:4010`)

Smoke suite validates:
1. Auth guard redirect on `/app` for unauthenticated sessions
2. Authenticated API access
3. CSV import dedupe/upsert behavior
4. Reminder create and complete flow
5. Questionnaire intake insert + update behavior (`/api/intake`)

### Generic Ingest Smoke
After `next start` is running locally:
```bash
AGENT_ID=<your-auth-user-uuid> \
INGEST_WEBHOOK_SECRET=<your-webhook-secret> \
INGEST_PROCESSOR_SECRET=<your-processor-secret> \
./scripts/smoke_ingest.sh
```

## Receptionist V1 Notes
- Architecture, flow behavior, and provider wiring notes: [`docs/receptionist-v1.md`](docs/receptionist-v1.md)
- Go-live commands and checklist: [`docs/receptionist-go-live.md`](docs/receptionist-go-live.md)

## Documentation
- System architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- V1 product boundaries: [`V1_SCOPE.md`](V1_SCOPE.md)
- Deployment quick entry: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Detailed deploy checklist: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Engineering improvement log: [`ENGINEERING_AUDIT.md`](ENGINEERING_AUDIT.md)
