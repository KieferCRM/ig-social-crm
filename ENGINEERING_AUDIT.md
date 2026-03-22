# ENGINEERING_AUDIT

## 2026-03-11 - Stack and UX/ingestion reliability pass

### Improvement 1: Confirmed UI stack and styling architecture
- Issue discovered: Styling system assumptions were inconsistent across previous changes.
- Reasoning: Production polish and future component work require clear stack boundaries.
- Code change:
  - Verified `tailwindcss` + `@tailwindcss/postcss` in `package.json`.
  - Verified global CRM style system in `src/app/globals.css` (`crm-*` utility classes and tokens).
  - Confirmed no shadcn/ui or styled-components dependency footprint.
- Result: Future UI work can stay aligned with the existing Tailwind + global-token approach.

### Improvement 2: Intake dedupe now matches by stable identity (not only handle)
- Issue discovered: Repeated intake submissions could create duplicates when `ig_username` changed or was missing.
- Reasoning: Paying agents need one evolving lead record per person, not fragmented duplicates.
- Code change:
  - Added shared lead identity utilities in `src/lib/leads/identity.ts`.
  - Updated `src/app/api/intake/route.ts` to resolve existing leads by source reference, phone, email, then handle.
  - Preserved existing owner/assignee and stage/temp metadata when intake updates an existing lead.
  - Merged `source_detail`/`custom_fields` safely instead of overwriting.
- Result: Intake submissions now reliably update existing leads when identity overlaps.

### Improvement 3: Manual lead creation uses same dedupe logic
- Issue discovered: `/api/leads/simple` still deduped primarily by synthetic/handle key.
- Reasoning: Manual add must not create duplicates when a lead already exists by phone/email.
- Code change:
  - Refactored `src/app/api/leads/simple/route.ts` to reuse identity helpers.
  - Added stage/temperature validation for POST.
  - Preserved existing ownership, consent metadata, and source detail while filling missing fields.
- Result: Manual lead creation now converges with intake behavior and lowers duplicate risk.

### Improvement 4: Receptionist webhook accepts real provider payload shapes
- Issue discovered: Webhook handling was too rigid for production SMS/call providers.
- Reasoning: Receptionist channel must ingest inbound events reliably from form-encoded and JSON payloads.
- Code change:
  - Replaced `src/app/api/receptionist/webhook/route.ts` with robust parser + auth flow.
  - Added Twilio form payload support and signature validation path.
  - Kept shared-secret auth fallback for local tooling and custom bridges.
- Result: Webhook ingestion is production-safe for V1 provider wiring.

### Improvement 5: Added receptionist smoke/replay tooling
- Issue discovered: No repeatable way to validate receptionist E2E behavior.
- Reasoning: Fast regression checks are required before customer-facing deploys.
- Code change:
  - Added `scripts/receptionist_webhook_examples.sh`.
  - Added `scripts/smoke_receptionist.mjs`.
  - Added npm script `smoke:receptionist`.
- Result: Team can validate lead upsert, interaction logging, urgency, and alerts quickly.

### Improvement 6: Lead communication actions now fail safely
- Issue discovered: Call/Text actions could appear available when communications prerequisites were missing.
- Reasoning: Broken action buttons reduce trust in production.
- Code change:
  - Updated `src/components/leads/lead-detail-panel.tsx`.
  - Added communication blocker logic, disabled states, and receptionist settings jump link.
- Result: Agents get clear next steps instead of silent action failures.

### Improvement 7: Deployment and go-live runbooks updated
- Issue discovered: Deployment docs were missing receptionist and latest SQL steps.
- Reasoning: Go-live reliability depends on explicit, executable checklists.
- Code change:
  - Updated `docs/DEPLOYMENT.md` with v27/v28 SQL + receptionist env/smoke checks.
  - Added `docs/receptionist-go-live.md` and linked from README.
- Result: Deployment process now covers both questionnaire and receptionist intake paths.

## Validation
- `npm run -s typecheck` passed after the intake/manual dedupe refactor.
- `npm run -s preflight:env:core` passed.
- `npm run -s smoke:receptionist` failed fast as expected without `RECEPTIONIST_WEBHOOK_SECRET` set.
- Targeted eslint command stalled in this environment and needs rerun locally before production release gate.
