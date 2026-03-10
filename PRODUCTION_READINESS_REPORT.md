# Production Readiness Report

Audit date: 2026-03-06  
Repository: `/Users/kieferfrazier/Desktop/ig-social-crm`  
Scope: this repository only (no assumptions from other projects)

## Remediation Update (2026-03-09)

### Completed in code
- Rebuilt `src/app/api/import-leads/route.ts` with a clean import pipeline:
  - deterministic identity resolution across `ig_username`, `email`, `phone`, and `external_id`
  - in-file dedupe by resolved identity handle
  - cross-check against existing leads before upsert
  - row-level validation for `stage` and `lead_temp`
  - file-size and row-count limits retained (`2MB`, `5000 rows`)
  - preserved automation trigger for newly inserted leads
- Hardened intake source-method compatibility in `src/app/api/intake/route.ts`:
  - set `first_source_method` and `latest_source_method` to `"api"` (schema-safe)
  - validated `INTAKE_AGENT_ID` format as UUID
- Fixed pipeline stage mismatch:
  - updated Kanban stages in `src/app/app/kanban/kanban-client.tsx` to `New`, `Contacted`, `Qualified`, `Closed`
- Removed Meta coupling from solo smoke path:
  - `scripts/smoke_solo.mjs` now validates questionnaire intake (`/api/intake`) plus FUB-style CSV import, not `/api/meta/webhook`
  - removed dependency on `META_WEBHOOK_DEV_HEADER_ENABLED` for smoke
  - added explicit `INTAKE_AGENT_ID` requirement for smoke
- Added solo compatibility shim for legacy team route imports:
  - created `src/lib/team.ts` so legacy `/api/team/*` routes compile safely while remaining inactive without a team context
- Updated launch docs for no-Meta, website-first ingestion:
  - `README.md`
  - `docs/ops/p0_handoff_checklist.md`
  - `docs/DEPLOYMENT.md`
  - `docs/V1.md`
- Improved website-first launch reliability:
  - removed build-time dependency on Google font fetch by switching `src/app/layout.tsx` to local font stacks via CSS variables in `src/app/globals.css`
  - updated homepage CTAs in `src/app/page.tsx` to prioritize public intake and FUB import paths

### Verification status from this environment
- `preflight:env:core` passes.
- TypeScript issues originally blocking launch (import route syntax + missing team module) are resolved.
- Full `lint` and `next build` commands were attempted repeatedly but hung in this execution environment (no diagnostic output before forced termination), so final lint/build confirmation must be run on your machine.

### Remaining manual tasks (owner-side)
1. Run final gates locally and capture results:
   - `npm run release:check`
   - `npm run release:check:with-smoke`
2. Apply and verify SQL migration chain in Supabase:
   - `v4_step20` -> `v4_step21` -> `v4_step22` -> `v4_step23` -> `v4_step24` (and `v4_step25` only if reminder-policy issue appears)
3. Set production env vars in Vercel/Supabase secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `INTAKE_AGENT_ID`
   - `INGEST_WEBHOOK_SECRET`
   - `INGEST_PROCESSOR_SECRET`
   - `RATE_LIMIT_REDIS_REST_URL`
   - `RATE_LIMIT_REDIS_REST_TOKEN`
   - plus ManyChat vars only if enabling ManyChat
4. Run end-to-end production checks:
   - submit `/intake` twice (insert then update)
   - import a real FUB CSV and verify inserted/updated/skipped/error behavior
   - verify Kanban stage transitions + reminders
   - verify `/api/health` + uptime alerts

## Executive Verdict

**Current status: not production-ready for a full lead-intelligence launch.**

The codebase has strong building blocks (Next.js + Supabase, RLS-driven tenancy, real ingestion routes, identity/intent schema in Step 20), but there are launch blockers in security hardening, ingestion reliability, dedup/idempotency, and UX completeness.

Runtime validation note: this environment does not have `node`/`npm`, so lint/build/typecheck/smoke commands could not be executed during this audit.

---

## 1. System Architecture Overview

### Frontend Framework
- Next.js App Router (`src/app/*`) with React client/server components.
- UI is mostly inline-style components with shared theme in `src/app/globals.css`.

### Backend Services
- Next.js Route Handlers under `src/app/api/*`.
- Supabase Postgres + Supabase Auth.
- SSR/browser/admin Supabase clients:
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/browser.ts`
  - `src/lib/supabase/admin.ts`

### Database Schema
- SQL migrations are in `docs/sql/*`.
- Key modules discovered:
  - Messaging + Meta token storage: `v2_step1_meta_foundation.sql`
  - Qualification + reminders: `v2_step5_to_step12_foundation.sql`
  - Webhook observability: `v2_step13_webhook_observability.sql`
  - Appointment tracking: `v2_step14_appointment_tracking.sql`
  - Team collaboration + shared RLS model: `v3_team_collaboration_foundation.sql`
  - Reminder owner compatibility bridge: steps 16/17/18
  - Automation rules: `v3_step19_automation_rules_foundation.sql`
  - Lead intelligence primitives: `v4_step20_lead_intelligence_foundation.sql`

### Edge/Serverless Functions
- No Supabase Edge Functions are present in this repo.
- Legacy docs/scripts reference external `ig_progress` function (`scripts/test_ig_progress.sh`, `docs/DEPLOYMENT.md`), but implementation is not in-repo.

### Authentication System
- Supabase email/password auth (`src/app/auth/page.tsx`).
- Middleware auth guard on `/app/*` plus debug paths (`middleware.ts`).
- Signup is feature-flag disabled (`src/lib/features.ts`).

### Multi-Tenant Design
- Shared-owner model uses `agent_id` plus optional `team_id`.
- Team context determined by first active membership (`src/lib/team.ts`, `public.current_team_id()` in SQL).
- RLS policies exist for major tables and are team-aware in V3/V4 migrations.
- Team switching is not implemented; model assumes a single active team context.

### Integrations
- Meta OAuth + webhook ingestion:
  - `src/app/api/meta/connect/start/route.ts`
  - `src/app/api/meta/connect/callback/route.ts`
  - `src/app/api/meta/webhook/route.ts`
- ManyChat webhook ingestion:
  - `src/app/api/integrations/manychat/webhook/route.ts`
- Public intake embed/form ingestion:
  - `/intake` UI + `src/app/api/intake/route.ts`
- CSV import/export:
  - `src/app/api/import-leads/route.ts`
  - `src/app/api/export-leads/route.ts`

### End-to-End Flow (as implemented)
1. Source event enters through Meta, ManyChat, intake form, CSV import, manual lead entry, or authenticated event ingest endpoint.
2. Route normalizes payload and writes to `leads` (not all routes), plus optional intelligence tables (`lead_people`, `lead_signal_events`, `lead_identity_fragments`, `lead_intent_signals`, `lead_recommendations`).
3. UI surfaces pipeline in Dashboard/List/Kanban and reminders/social inbox.
4. Team routes exist but team UX is feature-flag hidden in current release.

---

## 2. Ingestion Architecture

### Ingestion Paths and Readiness

| Path | Source Type | Auth | Validation | Dedup/Idempotency | Major Weaknesses |
|---|---|---|---|---|---|
| `/api/meta/webhook` | Meta DM webhook | HMAC signature (required in prod) | good | good message-level dedupe via unique/upsert | no rate limit; dev impersonation header path in non-prod (`x-agent-id`) |
| `/api/integrations/manychat/webhook` | ManyChat webhook | shared secret | medium | partial (only if `external_message_id` present) | no rate limit/replay window; secret accepted via query/body; **does not auto-create lead when no existing lead** |
| `/api/intake` | website/landing/questionnaire form | public (no auth) | medium | upsert by synthetic `ig_username` | no rate limit/CAPTCHA/signature; malformed JSON can 500; service-role write |
| `/api/import-leads` | CSV import | authenticated | medium-high row validation | strong per `(agent_id, ig_username)` | no file size/row caps; custom parser only; large imports run synchronously |
| `/api/leads/simple` POST | manual entry/API | authenticated | medium | upsert by `(agent_id, ig_username)` | dedupe depends on generated IG key; cross-channel duplicate risk |
| `/api/events/ingest` | authenticated generic event API | authenticated | high schema checks | none (no idempotency key) | no rate limit; **does not auto-create lead when no lead_id** |

### Ingestion Weakness Summary
- No global rate limiting, abuse protection, or burst controls across public webhook/form endpoints.
- Idempotency is inconsistent (strong for Meta messages and CSV upsert; weak for generic events and Some ManyChat payloads).
- Two important intelligence routes can produce person/signal records without ensuring a lead row exists.
- No queue/dead-letter/retry pipeline for ingestion failures.

---

## 3. Lead Schema Evaluation

### How “Lead” Is Currently Represented

Observed/used lead fields (from routes + migrations):
- Identity/core: `id`, `agent_id`, `ig_username`
- Pipeline: `stage`, `lead_temp`, `time_last_updated`, `archived_at`
- Qualification: `intent`, `timeline`, `budget_range`, `location_area`, `contact_preference`, `next_step`, `last_qualification_bucket_asked`
- Source/attribution: `source`, `last_message_preview`, `first_source_channel`, `latest_source_channel`, `first_source_method`, `latest_source_method`, `first_touch_at`, `first_touch_message_id`, `source_confidence`, `source_detail` (jsonb)
- Team ownership: `team_id`, `owner_user_id`, `assignee_user_id`, `visibility`, `flow_type`

### Field Coverage vs Production Lead Intelligence Needs

Already present as first-class columns:
- `source`, `stage`, `intent`, `timeline`, `notes`, `created/updated style timestamp via time_last_updated`, `social handle (ig_username)`

Present but semi-structured (not normalized):
- `email`, `phone`, `full_name`, `tags`, `external_id`, UTM values are often stored in `source_detail` jsonb

Missing or weak for production intelligence:
- No first-class `lead_score`
- No first-class `company`
- No first-class `website`
- No normalized `tags` table
- No canonical email/phone columns directly on `leads`
- No explicit lead lifecycle timestamps (first qualified, first contacted, closed_at, won/lost reason)
- No deterministic external source identity table tied directly to `leads`

### Does Schema Support Enrichment?
- Partially yes.
- Strong enrichment primitives now exist in Step 20:
  - `lead_people`
  - `lead_identity_fragments`
  - `lead_signal_events`
  - `lead_intent_signals`
  - `lead_recommendations`
- Gaps: enrichment is not fully wired into all ingestion paths and not fully normalized back into the core `leads` record.

### Recommended Production-Ready Lead Intelligence Schema

1. Keep `leads` as canonical deal/pipeline record, add/normalize:
- `full_name`, `primary_email`, `primary_phone`, `company`, `website`, `lead_score`, `score_updated_at`, `closed_at`, `lost_reason`, `won_value`

2. Add normalized identity + attribution tables:
- `lead_identities(lead_id, type, normalized_value, source, confidence, first_seen_at, last_seen_at)` unique on `(agent_id, type, normalized_value)`
- `lead_attribution(lead_id, first_touch, latest_touch, utm_*, campaign_id, source_platform, external_contact_id)`

3. Add normalized taxonomy tables:
- `lead_tags(tag_id, name)`
- `lead_tag_links(lead_id, tag_id)`

4. Add scoring and timeline audit:
- `lead_score_events(lead_id, score_delta, reason_code, created_at)`
- `lead_timeline_events(lead_id, event_type, payload, occurred_at)`

5. Add merge/audit safety:
- `lead_merge_log(source_lead_id, target_lead_id, merged_by, merged_at, metadata)`

---

## 4. Identity Resolution Strategy

### Current Strategy
- Manual/CSV/intake dedupe primarily by `(agent_id, ig_username)` upsert.
- Event intelligence routes build normalized fragments (`email/phone/ig/fb/external_id/name`) and attempt fragment match in `lead_identity_fragments`.
- Manual merge endpoint exists: `/api/leads/merge`.

### Strengths
- Exact matching for normalized identifiers exists.
- Fragment uniqueness by `(agent_id, fragment_type, fragment_normalized)` is a good base.

### Gaps
- No deterministic idempotency key model for all event sources.
- No fuzzy matching (`name+company`, typo tolerance, phone/email similarity).
- No confidence-threshold merge workflow with human review queue.
- Merge operation updates only selected lead fields/reminders, not full intelligence graph (`lead_people`, `lead_signal_events`, `lead_intent_signals`, `lead_recommendations`).

### Recommended Identity Resolution Improvements
1. Add `idempotency_key` (source message/event id) with unique constraint per agent/source.
2. Always write incoming identifiers to `lead_identities` and run match pipeline before lead creation.
3. Implement deterministic merge transaction that re-parents intelligence rows to target lead.
4. Add probabilistic match scoring for weak identifiers and send uncertain matches to review queue.

---

## 5. Security Review

### Positive Controls
- RLS enabled broadly in migration files for leads, team data, reminders, intelligence tables.
- Most authenticated APIs load user via Supabase SSR and scope queries by owner/team.
- Meta webhook signature verification is implemented for production mode.
- OAuth state cookie checks exist in Meta callback.

### Findings (ordered by severity)

#### High
1. **Service-role bypass on mutable reminder routes weakens policy intent**
- `src/app/api/reminders/route.ts`
- `src/app/api/reminders/[id]/route.ts`
- Routes use `supabaseAdmin()` and custom checks, bypassing RLS policy checks. Current checks allow any same-team user to mutate reminders, even where RLS intended stricter owner/adminish checks.

2. **Public intake endpoint has weak abuse controls**
- `src/app/api/intake/route.ts`
- Public write endpoint has only honeypot protection. Missing rate limiting, CAPTCHA/turnstile, shared secret/HMAC option, payload size guard, and robust malformed body handling.

3. **Meta webhook dev impersonation path in non-production**
- `src/app/api/meta/webhook/route.ts` (`x-agent-id` dev mode)
- Useful locally, but dangerous in preview/shared non-prod environments.

4. **Webhook status endpoint likely broken for team users**
- `src/app/api/meta/webhook/events/route.ts`
- `src/lib/team.ts`
- `docs/sql/v2_step13_webhook_observability.sql`
- Route applies `teamOrOwnerFilter` including `team_id`, but `meta_webhook_events` table has no `team_id` column.

#### Medium
5. **CSV export formula injection risk**
- `src/app/api/export-leads/route.ts`
- Escaping handles quotes/newlines but not spreadsheet formula prefixes (`=`, `+`, `-`, `@`).

6. **Debug/test routes exposed through middleware matcher**
- `middleware.ts` includes `/ping` and `/_debug/:path*`
- `/ping` writes test rows into `leads` (`src/app/ping/page.tsx`).

7. **ManyChat secret accepted via query/body increases leakage risk**
- `src/app/api/integrations/manychat/webhook/route.ts`
- Secret may appear in logs/proxies/history when passed as query param.

8. **Weak token encryption key fallback**
- `src/app/api/meta/connect/callback/route.ts`
- Falls back to service-role key or hardcoded dev value if `META_TOKEN_ENCRYPTION_KEY` missing.

9. **`lead_id` ownership is not consistently validated in all write paths**
- Example routes: `src/app/api/events/ingest/route.ts`, `src/app/api/reminders/route.ts`
- Could allow cross-tenant foreign-key linkage if IDs are known.

---

## 6. Infrastructure Gaps

1. No centralized monitoring/alerting (no Sentry/Datadog/OpenTelemetry wiring).
2. No ingestion job queue, retry worker, or dead-letter handling.
3. No rate limiting middleware for public and webhook routes.
4. Minimal environment preflight coverage (`scripts/preflight_env.mjs` checks only `core`/`meta`).
5. No in-repo CI test suite; only smoke script, and runtime toolchain unavailable in this environment.
6. No strict request schema validation library (e.g., Zod) across all ingestion handlers.
7. No explicit payload/body size constraints for large imports/webhooks.
8. No full baseline migration for `public.leads` found in this repository; only incremental `ALTER TABLE` steps are present.

---

## 7. Required Fixes Before Production

1. Add rate limiting and abuse protection on `/api/intake`, `/api/meta/webhook`, `/api/integrations/manychat/webhook`, and `/api/events/ingest`.
2. Remove or hard-disable `/ping` and `/_debug/*` in production builds.
3. Fix `/api/meta/webhook/events` query filter to match actual table columns.
4. Replace reminder mutations to use non-service-role client where possible, or enforce strict owner/admin checks equivalent to intended RLS.
5. Add explicit idempotency keys and duplicate handling for `/api/events/ingest` and ManyChat events without `external_message_id`.
6. Ensure all ingestion paths can create/update canonical `leads` (ManyChat and generic events currently can leave orphan intelligence records).
7. Harden CSV export against formula injection.
8. Enforce required `META_TOKEN_ENCRYPTION_KEY` in production and remove unsafe fallback.
9. Validate provided `lead_id` ownership/team membership before inserts in all write endpoints.
10. Add payload size limits and parse guards (`request.json()` and upload size limits).
11. Align stage model across UI/API (Kanban uses `Warm/Hot` as stage; APIs/reports expect canonical stage set).
12. Ship missing schema baseline documentation/migration path for fresh production environments.

### UX Readiness Blockers
- Team Hub is feature-flag hidden (`FEATURE_TEAM_ENABLED=false`).
- Automation settings UI is feature-flag hidden (`FEATURE_AUTOMATION_UI_ENABLED=false`).
- Signup is paused (`FEATURE_SIGNUP_ENABLED=false`).
- Several pages use fixed multi-column inline grids that are weak on mobile (`manual-lead-form`, reminder composer, Kanban layout).
- Dashboard exposes internal “Ingest Tester” controls intended more for operator testing than agent workflows.

---

## 8. Recommended Improvements (Post-Blocker)

1. Introduce an ingestion gateway service (schema validation, auth, rate limit, idempotency, queue dispatch).
2. Add background workers for enrichment, scoring, dedupe review, and recommendation generation.
3. Implement first-class lead scoring with explainable score events.
4. Build a reconciliation job that normalizes `source_detail` into canonical lead fields.
5. Add observability dashboard: ingest volume, dedupe rate, failure rate, retry rate, lead-creation latency.
6. Add automated integration tests for tenant isolation and webhook replay behavior.
7. Add team switching context if multi-team per user is a product requirement.
8. Add merge assistant UI driven by identity confidence and match reasons.

---

## Appendix: Key Files Reviewed

- Architecture/runtime: `package.json`, `middleware.ts`, `src/lib/*`
- Ingestion routes: `src/app/api/meta/webhook/route.ts`, `src/app/api/integrations/manychat/webhook/route.ts`, `src/app/api/intake/route.ts`, `src/app/api/import-leads/route.ts`, `src/app/api/events/ingest/route.ts`, `src/app/api/leads/simple/route.ts`
- Security-sensitive routes: reminders, recommendations, team assignment/archive/tasks/comments
- SQL migrations: `docs/sql/v2*`, `docs/sql/v3*`, `docs/sql/v4_step20_lead_intelligence_foundation.sql`
- UX pages: dashboard, kanban, list, import, intake, channels, team, onboarding
