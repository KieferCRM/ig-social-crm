# Chief Orchestrator — Design Spec

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** MVP — replace `inferRecommendation()` with a Claude-powered decision engine

---

## Overview

The Chief Orchestrator (CO) is the AI brain of LockboxHQ. It is the only layer with full system context and the only layer that decides what should happen next. Every inbound event — form submission, call, SMS, manual update — flows through the CO before any task, deal, or contact update is created.

The CO replaces the existing `inferRecommendation()` function in `/src/app/api/events/ingest/route.ts`. Everything else in the ingestion pipeline stays the same. No new routes, no new tables.

---

## Architecture

### Entry Point

```
/src/app/api/events/ingest/route.ts
  → inferRecommendation() [DELETE]
  → runChiefOrchestrator(context) [REPLACE WITH]
```

### New File

```
/lib/orchestrator/index.ts
```

Single exported function:

```ts
export async function runChiefOrchestrator(
  context: OrchestratorContext
): Promise<OrchestratorDecision>
```

---

## Context Shape

Everything the CO needs to make a decision. Assembled in the ingest route from existing data already in scope.

```ts
type OrchestratorContext = {
  lead: {
    id: string
    full_name: string | null
    stage: string | null
    source: string | null
    created_at: string
  }
  event: {
    type: string          // "form_submission" | "inbound_call" | "sms" | etc.
    channel: string | null
    message_text: string | null
  }
  intent: {
    intent_type: string | null      // "buyer" | "seller" | "investor"
    timeline_window: string | null  // "ASAP" | "30_days" | "90_days" | etc.
    location_interest: string | null
    budget_min: number | null
    budget_max: number | null
  }
  path: "real_estate" | "wholesaler"
  open_tasks: Array<{
    title: string
    urgency: string | null
    created_at: string
  }>
}
```

**`path` detection:** Read from a `user_workspaces` or equivalent config table keyed to the authenticated user's account. Default to `"real_estate"` if unset.

**`open_tasks`:** Query existing open tasks for this lead. Pass only the fields above — no historical recommendations, no prior AI outputs.

---

## Decision Shape

The CO returns a structured decision object. The ingest route applies it.

```ts
type OrchestratorDecision = {
  // Task decision
  task_action: "create" | "update" | "replace" | "none"
  task_reason: string                  // human-readable explanation
  target_task_id?: string              // required for update/replace
  closed_reason?: "replaced_by_newer_task" | "no_longer_relevant" | "duplicate"
  task?: {
    type: "call" | "text" | "email" | "follow_up" | "document_review" | "booking" | "status_update"
    title: string
    reason: string
    description: string
    due_at: string | null              // ISO 8601
    priority_bucket: "Do Now" | "At Risk" | "Upcoming"
    context_snapshot: Record<string, unknown>
  }

  // Deal decision
  deal_action: "create" | "none"
  deal?: {
    type: "buyer" | "seller" | "wholesale" | "listing" | "acquisition" | "unknown"
    title: string
    stage: "new" | "qualified" | "active"
    motivation: string | null
    timeline: string | null
  }

  // Contact updates (optional)
  contact_updates?: {
    contact_type?: "buyer" | "seller" | "investor" | "unknown"
    motivation?: string
  }
}
```

---

## Path Behavior Rules

The CO uses a single system prompt with path-conditional logic baked in. It is not two separate agents.

### Real Estate Agent Path

| Signal | Behavior |
|--------|----------|
| Any new lead | Create a task — speed-to-lead is the #1 lever (5min = 10x contact rate) |
| Buyer intent | Task type: `call`, due in 2 hours, priority: `Do Now` |
| Seller intent | Task type: `call`, due in 4 hours, priority: `Do Now` |
| Vague or cold lead | Task still created: `follow_up`, due 24h, priority: `Upcoming` |
| Active open task exists | Evaluate: update or keep existing. Do not duplicate. |
| Cold lead, no activity >30 days | Priority: `At Risk` |
| No timeline, no intent | Task: general follow-up, `Upcoming` |

Key principle: **Never drop a real estate lead.** Cold leads → nurture. The task bucket changes, not the existence of the task.

---

### Wholesaler Path

Wholesalers filter fast. The CO applies the **Motivation Gate** before creating any task.

**MPTP Qualification Signals (from form/message/event):**
- **M** — Motivation: distress language, life event, urgency, forced sale
- **P** — Property: condition signals, address, vacancy
- **T** — Timeline: ASAP, date-specific, moving fast
- **P** — Price: below-market expectation, open to offer, "just want out"

**Motivation Signal Scoring:**

| Score | Behavior |
|-------|----------|
| 0 signals | 30-day passive follow-up only. No high-priority task. |
| 1 signal | Single follow-up task, `Upcoming`, due 24h |
| 2 signals | Priority follow-up, `At Risk`, due 4h |
| 3+ signals | `Do Now`, due 1–2h. Drop everything. |

**Priority Decay:**
- Wholesale leads lose urgency fast — 24h window before downgrade
- No action in 72h → `At Risk`
- No action in 7 days → likely dead, deprioritize

**Deal Creation:**
- Wholesaler deals are created when motivation ≥ 2 signals
- Deal type: `wholesale`, stage: `qualified`
- MAO context (ARV, repair estimate) added to `context_snapshot` if available

---

## Implementation: `runChiefOrchestrator()`

### Approach

Single Claude API call (claude-sonnet-4-6) per event. Stateless. The system prompt encodes path behavior rules. The context is injected as a user message. Response is parsed structured JSON.

```ts
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function runChiefOrchestrator(
  context: OrchestratorContext
): Promise<OrchestratorDecision> {
  const systemPrompt = buildSystemPrompt(context.path)
  const userMessage = buildContextMessage(context)

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  return parseDecision(response)
}
```

### System Prompt Structure

```
You are the Chief Orchestrator for LockboxHQ, a multi-agent AI operating system for real estate.

Your job: receive structured context about an event and return a JSON decision about what the system should do next.

You operate on the [real_estate | wholesaler] path. [Path-specific rules injected here.]

Rules:
- Return ONLY valid JSON matching the OrchestratorDecision schema
- Do not create duplicate tasks if one already exists and is still valid
- Explain every decision in task_reason
- If no action is needed, return task_action: "none" with a reason

[Schema definition injected here]
```

### Fallback

If the Claude API call fails (timeout, error, malformed JSON): fall back to a minimal safe default — create a basic `follow_up` task, `Upcoming`, due 24h. Log the error. Never throw — the ingest pipeline must not break.

---

## Integration: Ingest Route

The change in `/src/app/api/events/ingest/route.ts` is surgical:

**Before:**
```ts
const rec = inferRecommendation({ eventType, intentType, timelineWindow, messageText })
if (rec) {
  await supabase.from("lead_recommendations").insert({ ... })
}
```

**After:**
```ts
const decision = await runChiefOrchestrator({
  lead: { id: lead.id, full_name: lead.full_name, stage: lead.stage, source: lead.source, created_at: lead.created_at },
  event: { type: eventType, channel: event.channel ?? null, message_text: messageText },
  intent: { intent_type: intentType, timeline_window: timelineWindow, location_interest, budget_min, budget_max },
  path: await getWorkspacePath(workspaceId),
  open_tasks: await getOpenTasks(lead.id),
})

await applyDecision(decision, lead.id, supabase)
```

`applyDecision()` is a new helper (same file or `/lib/orchestrator/apply.ts`) that handles the task insert/update/replace, deal creation, and contact update writes.

---

## Today Page Impact

No changes to the Today Page API. The Today Page already reads from `lead_recommendations` and tasks. Once the CO writes better-quality tasks (correct priority buckets, accurate due dates, path-aware reasoning), the Today Page improves automatically.

The Follow-Up Specialist (prioritization layer) runs as a rule-based pass for MVP:

| Condition | Priority Bucket |
|-----------|----------------|
| `due_at` within 2 hours OR new lead | `Do Now` |
| No activity > 48 hours | `At Risk` |
| Everything else | `Upcoming` |

---

## What This Does Not Include (MVP Scope)

- Outbound communication triggering (Secretary not wired yet)
- Scheduling / calendar integration
- Document-triggered orchestration
- Real-time re-evaluation of stale tasks (cron-based sweep — future phase)
- Follow-Up Specialist as a separate AI call (rule-based pass for MVP)
- Teams path (future)

---

## Success Criteria

1. Form submission triggers `runChiefOrchestrator()` end-to-end without errors
2. Real estate leads always produce a task with a correct priority bucket
3. Wholesaler leads with 0 motivation signals do NOT produce a `Do Now` task
4. Wholesaler leads with 3+ signals produce a `Do Now` task due within 2 hours
5. Duplicate task prevention: if a valid open task exists, CO returns `task_action: "none"` or `"update"` not `"create"`
6. API failure fallback creates a safe default task without breaking the pipeline
7. `path` defaults to `"real_estate"` if workspace config is missing
