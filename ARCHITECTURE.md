# LockboxHQ Architecture

## Product Shape
LockboxHQ is an ingestion-first CRM for real estate agents with two lead-entry channels:
- Questionnaire intake (`/intake` and `/api/intake`)
- Receptionist intake (SMS/call webhooks through `/api/receptionist/*`)

Both channels write to the same `leads` model and pipeline.

## Frontend Stack
- Next.js App Router + TypeScript
- Tailwind present, with primary UI styling via `src/app/globals.css` CRM classes/tokens (`crm-*`)
- No shadcn/ui dependency in this codebase
- No styled-components dependency in this codebase

## Backend Stack
- Supabase Postgres + RLS
- Supabase Auth (agent-scoped access)
- Next.js route handlers for ingestion, lead CRUD, pipeline, settings

## Core Data Flow
1. Intake submission or receptionist event arrives.
2. Identity normalization runs (phone/email/handle/source ref).
3. Lead is upserted/updated in `leads`.
4. Event artifacts are logged (`lead_events`, `lead_interactions`, `receptionist_alerts`).
5. Lead appears in workspace/list/pipeline views.

## Key Tables (Current Focus)
- `leads`: source of truth for lead profile + pipeline state
- `lead_events`: intake and lifecycle event log
- `lead_interactions`: sms/call communication timeline
- `receptionist_alerts`: urgency/escalation notices
- `follow_up_reminders`: operational follow-up queue

## Reliability Principles
- Prefer identity-based dedupe over source-specific keys
- Preserve existing high-quality lead fields on repeat ingestion
- Validate and reject malformed payloads with explicit errors
- Keep feature paths agent-scoped and RLS-safe
