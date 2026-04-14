# Chief Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rule-based `inferRecommendation()` function in the event ingest pipeline with a Claude-powered Chief Orchestrator that creates path-aware, channel-aware tasks for both real estate agents and wholesalers.

**Architecture:** A single `runChiefOrchestrator(context)` function in `src/lib/orchestrator/index.ts` makes a Claude API call, parses the structured JSON decision, and returns it. A companion `applyDecision()` helper in `src/lib/orchestrator/apply.ts` writes the task/deal/contact updates to Supabase. The ingest route calls both in sequence, replacing the 6-line `inferRecommendation` block.

**Tech Stack:** `@anthropic-ai/sdk` (already installed at ^0.80.0), Next.js App Router, Supabase, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/orchestrator/index.ts` | Create | `runChiefOrchestrator()` — Claude API call, prompt building, JSON parsing, fallback |
| `src/lib/orchestrator/apply.ts` | Create | `applyDecision()` — writes task, deal, and contact updates to Supabase |
| `src/lib/orchestrator/types.ts` | Create | `OrchestratorContext` and `OrchestratorDecision` types |
| `src/lib/orchestrator/prompt.ts` | Create | `buildSystemPrompt()` and `buildContextMessage()` — prompt construction |
| `src/lib/workspace-settings.ts` | Modify | Add `operator_path: "real_estate" \| "wholesaler"` to `WorkspaceSettings` |
| `src/app/api/events/ingest/route.ts` | Modify | Replace `inferRecommendation()` block with CO call (lines 793–823) |
| `src/lib/orchestrator/__tests__/index.test.ts` | Create | Unit tests for orchestrator logic |
| `src/lib/orchestrator/__tests__/prompt.test.ts` | Create | Unit tests for prompt builders |

---

## Task 1: Add `operator_path` to WorkspaceSettings

**Files:**
- Modify: `src/lib/workspace-settings.ts`

- [ ] **Step 1: Add `operator_path` to the `WorkspaceSettings` type**

In `src/lib/workspace-settings.ts`, add to the `WorkspaceSettings` type (after `documents`):

```ts
export type OperatorPath = "real_estate" | "wholesaler";

export type WorkspaceSettings = {
  booking_link: string;
  hot_lead_notification_mode: HotLeadNotificationMode;
  hot_lead_business_hours_start: string;
  hot_lead_business_hours_end: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  saved_scripts: SocialScript[];
  documents: WorkspaceDocument[];
  operator_path: OperatorPath;  // <-- add this
};
```

- [ ] **Step 2: Add `operator_path` to `DEFAULT_WORKSPACE_SETTINGS`**

```ts
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  // ...existing fields...
  operator_path: "real_estate",
};
```

- [ ] **Step 3: Add normalizer and add to `normalizeWorkspaceSettings`**

Add this helper function near the other normalizers:

```ts
function normalizeOperatorPath(value: unknown): OperatorPath {
  if (value === "wholesaler") return "wholesaler";
  return "real_estate";
}
```

Then in `normalizeWorkspaceSettings`, add:

```ts
operator_path: normalizeOperatorPath(raw.operator_path),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspace-settings.ts
git commit -m "feat: add operator_path to WorkspaceSettings (real_estate | wholesaler)"
```

---

## Task 2: Create Orchestrator Types

**Files:**
- Create: `src/lib/orchestrator/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/lib/orchestrator/types.ts

export type OperatorPath = "real_estate" | "wholesaler";

export type PreferredChannel = "call" | "text" | "email" | null;

export type TaskType =
  | "call"
  | "text"
  | "email"
  | "follow_up"
  | "prepare_cma"
  | "send_listings"
  | "book_consultation"
  | "lender_referral"
  | "document_review"
  | "status_update";

export type PriorityBucket = "Do Now" | "At Risk" | "Upcoming";

export type TaskAction = "create" | "update" | "replace" | "none";

export type DealAction = "create" | "none";

export type OrchestratorContext = {
  lead: {
    id: string;
    full_name: string | null;
    stage: string | null;
    source: string | null;
    created_at: string;
  };
  event: {
    type: string;
    channel: string | null;
    message_text: string | null;
  };
  contact: {
    has_phone: boolean;
    has_email: boolean;
    preferred_channel: PreferredChannel;
  };
  intent: {
    intent_type: string | null;
    timeline_window: string | null;
    location_interest: string | null;
    budget_min: number | null;
    budget_max: number | null;
    property_address: string | null;
  };
  path: OperatorPath;
  open_tasks: Array<{
    title: string;
    urgency: string | null;
    created_at: string;
  }>;
};

export type OrchestratorTask = {
  type: TaskType;
  title: string;
  reason: string;
  description: string;
  due_at: string | null;
  priority_bucket: PriorityBucket;
  context_snapshot: Record<string, unknown>;
};

export type OrchestratorDeal = {
  type: "buyer" | "seller" | "wholesale" | "listing" | "acquisition" | "unknown";
  title: string;
  stage: "new" | "qualified" | "active";
  motivation: string | null;
  timeline: string | null;
};

export type OrchestratorDecision = {
  task_action: TaskAction;
  task_reason: string;
  target_task_id?: string;
  closed_reason?: "replaced_by_newer_task" | "no_longer_relevant" | "duplicate";
  task?: OrchestratorTask;
  deal_action: DealAction;
  deal?: OrchestratorDeal;
  contact_updates?: {
    contact_type?: "buyer" | "seller" | "investor" | "unknown";
    motivation?: string;
  };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/orchestrator/types.ts
git commit -m "feat: add OrchestratorContext and OrchestratorDecision types"
```

---

## Task 3: Create Prompt Builders

**Files:**
- Create: `src/lib/orchestrator/prompt.ts`
- Create: `src/lib/orchestrator/__tests__/prompt.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/orchestrator/__tests__/prompt.test.ts`:

```ts
import { buildSystemPrompt, buildContextMessage } from "../prompt";
import type { OrchestratorContext } from "../types";

const baseContext: OrchestratorContext = {
  lead: { id: "lead-1", full_name: "John Doe", stage: "New", source: "form", created_at: "2026-04-14T10:00:00Z" },
  event: { type: "form_submission", channel: "website", message_text: "I want to sell my house ASAP" },
  contact: { has_phone: true, has_email: false, preferred_channel: null },
  intent: { intent_type: "seller", timeline_window: "ASAP", location_interest: null, budget_min: null, budget_max: null, property_address: "123 Main St" },
  path: "real_estate",
  open_tasks: [],
};

describe("buildSystemPrompt", () => {
  it("includes real_estate path rules when path is real_estate", () => {
    const prompt = buildSystemPrompt("real_estate");
    expect(prompt).toContain("real_estate");
    expect(prompt).toContain("LPMAMA");
    expect(prompt).toContain("never drop");
  });

  it("includes wholesaler path rules when path is wholesaler", () => {
    const prompt = buildSystemPrompt("wholesaler");
    expect(prompt).toContain("wholesaler");
    expect(prompt).toContain("motivation gate");
    expect(prompt).toContain("MPTP");
  });

  it("includes OrchestratorDecision JSON schema", () => {
    const prompt = buildSystemPrompt("real_estate");
    expect(prompt).toContain("task_action");
    expect(prompt).toContain("priority_bucket");
  });
});

describe("buildContextMessage", () => {
  it("includes lead id in message", () => {
    const msg = buildContextMessage(baseContext);
    expect(msg).toContain("lead-1");
  });

  it("includes intent type", () => {
    const msg = buildContextMessage(baseContext);
    expect(msg).toContain("seller");
  });

  it("includes open tasks count", () => {
    const ctxWithTasks = {
      ...baseContext,
      open_tasks: [{ title: "Call John", urgency: "urgent", created_at: "2026-04-14T09:00:00Z" }],
    };
    const msg = buildContextMessage(ctxWithTasks);
    expect(msg).toContain("Call John");
  });

  it("notes preferred channel when set", () => {
    const ctxWithPref = { ...baseContext, contact: { ...baseContext.contact, preferred_channel: "text" as const } };
    const msg = buildContextMessage(ctxWithPref);
    expect(msg).toContain("text");
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx jest src/lib/orchestrator/__tests__/prompt.test.ts --no-coverage 2>&1 | tail -20
```

Expected: Cannot find module `../prompt`

- [ ] **Step 3: Create `src/lib/orchestrator/prompt.ts`**

```ts
// src/lib/orchestrator/prompt.ts
import type { OrchestratorContext, OperatorPath } from "./types";

const DECISION_SCHEMA = `
{
  "task_action": "create" | "update" | "replace" | "none",
  "task_reason": "string — explain your decision",
  "target_task_id": "string (required if task_action is update or replace)",
  "closed_reason": "replaced_by_newer_task" | "no_longer_relevant" | "duplicate" (required if replacing),
  "task": {
    "type": "call" | "text" | "email" | "follow_up" | "prepare_cma" | "send_listings" | "book_consultation" | "lender_referral" | "document_review" | "status_update",
    "title": "string",
    "reason": "string",
    "description": "string — what the agent should do and say",
    "due_at": "ISO 8601 string or null",
    "priority_bucket": "Do Now" | "At Risk" | "Upcoming",
    "context_snapshot": {}
  },
  "deal_action": "create" | "none",
  "deal": {
    "type": "buyer" | "seller" | "wholesale" | "listing" | "acquisition" | "unknown",
    "title": "string",
    "stage": "new" | "qualified" | "active",
    "motivation": "string or null",
    "timeline": "string or null"
  },
  "contact_updates": {
    "contact_type": "buyer" | "seller" | "investor" | "unknown",
    "motivation": "string"
  }
}
`.trim();

const REAL_ESTATE_RULES = `
## Path: real_estate

You are working with a traditional real estate agent (buyer's agent, listing agent, or both).

### Core Rules
- EVERY new lead gets a task. No exceptions. No filtering. No motivation gate.
- Speed-to-lead is the single highest-leverage action. Within 5 minutes = 10x contact rate.
- Cold leads never die — they move to nurture (Upcoming), not dropped.

### Channel Selection (in priority order)
1. If the lead stated a preferred channel (call/text/email) → use it
2. If phone is available → use "call"
3. If only email is available → use "email"
4. Fallback → "follow_up"

### Task Rules by Signal
- Buyer intent + phone: type="call", due=2 hours, priority="Do Now"
- Buyer intent + email only: type="email", due=2 hours, priority="Do Now"
- Seller intent + property address known: type="prepare_cma" first (pull comps before calling), due=4 hours, priority="Do Now". The description must tell the agent to research the property before reaching out.
- Seller intent + no address: type="call" (or preferred channel), due=4 hours, priority="Do Now"
- Referral source: same urgency as high-intent, but description uses warm relationship-aware framing. Note the referral context in context_snapshot.
- Open house: type="call" or "text", due=24 hours, priority="At Risk"
- Vague/no intent: type="follow_up", due=24 hours, priority="Upcoming"
- No activity >30 days: type="follow_up", due=48 hours, priority="At Risk"

### Qualification Framework
For buyer first-contact tasks, reference LPMAMA in the task description:
Location, Price, Motivation, Agent (are they working with anyone), Mortgage (pre-approved?), Appointment.
The goal of the first call is always to book an appointment — not close over the phone.

### Duplicate Prevention
If an open task already exists and is still relevant, return task_action="none" or "update". Never create a duplicate.

### Deal Creation
Create a deal when: intent_type is known AND timeline is present. Deal type maps to intent_type.
`.trim();

const WHOLESALER_RULES = `
## Path: wholesaler

You are working with a real estate wholesaler who sources off-market deals directly from sellers.

### Core Philosophy
Wholesalers filter fast. Do NOT create high-priority tasks for unmotivated leads. Time is the scarcest resource.

### Motivation Gate (MPTP Framework)
Before creating any task, score the lead on these 4 signals:
- M — Motivation: distress language, life event ("divorce", "foreclosure", "estate sale", "behind on payments"), urgency, forced sale
- P — Property: condition signals ("needs work", "as-is", "fixer"), address provided, vacancy mentioned
- T — Timeline: "ASAP", specific date within 90 days, "need to move fast"
- P — Price: below-market expectation ("just want out"), open to offer, "whatever you think it's worth"

### Scoring Rules
- 0 signals: type="follow_up", due=30 days, priority="Upcoming" — passive only
- 1 signal: type="follow_up", due=24 hours, priority="Upcoming"
- 2 signals: type="call" (or preferred channel), due=4 hours, priority="At Risk"
- 3+ signals: type="call" (or preferred channel), due=1-2 hours, priority="Do Now" — drop everything

### Priority Decay
Wholesale urgency decays fast. If a lead had signals but no action taken:
- 24h no action → downgrade from Do Now to At Risk
- 72h no action → At Risk
- 7 days no action → likely dead, priority="Upcoming"

### Deal Creation
Create a deal when motivation score >= 2. Deal type = "wholesale", stage = "qualified".
Include motivation signals in context_snapshot.

### MAO Context
If ARV or repair estimate is mentioned, include them in context_snapshot as { arv, repair_estimate, mao_estimate }.
MAO = (ARV × 0.70) − repair costs − wholesale fee (assume $10k default fee if not stated).

### Qualification Framework (MPTP)
The task description should guide the agent to qualify on: Motivation, Property, Timeline, Price.
`.trim();

export function buildSystemPrompt(path: OperatorPath): string {
  const pathRules = path === "wholesaler" ? WHOLESALER_RULES : REAL_ESTATE_RULES;

  return `You are the Chief Orchestrator for LockboxHQ, a multi-agent AI operating system for real estate.

Your job: receive structured context about a business event and return a single JSON decision about what the system should do next.

${pathRules}

## Output Rules
- Return ONLY valid JSON. No prose, no markdown, no code fences.
- Match the schema exactly. All fields shown are required unless marked optional.
- task is required when task_action is "create", "update", or "replace". Omit when "none".
- deal is required when deal_action is "create". Omit when "none".
- contact_updates is optional — only include if you have high-confidence updates.
- Always populate task_reason with a clear explanation of your decision.

## JSON Schema
${DECISION_SCHEMA}`;
}

export function buildContextMessage(context: OrchestratorContext): string {
  const { lead, event, contact, intent, open_tasks } = context;

  const channelInfo = contact.preferred_channel
    ? `preferred channel: ${contact.preferred_channel}`
    : contact.has_phone
      ? "phone available, no stated preference"
      : contact.has_email
        ? "email only, no phone"
        : "no contact method available";

  const openTasksSummary =
    open_tasks.length === 0
      ? "none"
      : open_tasks
          .map((t) => `- "${t.title}" (urgency: ${t.urgency ?? "unknown"}, created: ${t.created_at})`)
          .join("\n");

  return `## Incoming Event

Lead ID: ${lead.id}
Lead Name: ${lead.full_name ?? "unknown"}
Lead Stage: ${lead.stage ?? "New"}
Lead Source: ${lead.source ?? "unknown"}
Lead Created: ${lead.created_at}

Event Type: ${event.type}
Event Channel: ${event.channel ?? "unknown"}
Message: ${event.message_text ?? "(no message)"}

Contact Info: ${channelInfo}

Intent Type: ${intent.intent_type ?? "unknown"}
Timeline: ${intent.timeline_window ?? "unknown"}
Location Interest: ${intent.location_interest ?? "none"}
Budget: ${intent.budget_min != null || intent.budget_max != null ? `$${intent.budget_min ?? "?"} – $${intent.budget_max ?? "?"}` : "not stated"}
Property Address: ${intent.property_address ?? "not provided"}

Open Tasks:
${openTasksSummary}

Return your JSON decision now.`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx jest src/lib/orchestrator/__tests__/prompt.test.ts --no-coverage 2>&1 | tail -20
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/orchestrator/prompt.ts src/lib/orchestrator/__tests__/prompt.test.ts
git commit -m "feat: add orchestrator prompt builders with path-aware rules"
```

---

## Task 4: Create `runChiefOrchestrator()`

**Files:**
- Create: `src/lib/orchestrator/index.ts`
- Create: `src/lib/orchestrator/__tests__/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/orchestrator/__tests__/index.test.ts`:

```ts
import { runChiefOrchestrator } from "../index";
import type { OrchestratorContext } from "../types";
import Anthropic from "@anthropic-ai/sdk";

jest.mock("@anthropic-ai/sdk");

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

const baseContext: OrchestratorContext = {
  lead: { id: "lead-1", full_name: "Jane Smith", stage: "New", source: "form", created_at: "2026-04-14T10:00:00Z" },
  event: { type: "form_submission", channel: "website", message_text: "I want to buy a house" },
  contact: { has_phone: true, has_email: true, preferred_channel: null },
  intent: { intent_type: "buyer", timeline_window: "30_days", location_interest: "Austin", budget_min: 400000, budget_max: 600000, property_address: null },
  path: "real_estate",
  open_tasks: [],
};

const validDecision = {
  task_action: "create",
  task_reason: "New buyer lead with 30-day timeline. Speed-to-lead is critical.",
  task: {
    type: "call",
    title: "Call Jane Smith — new buyer inquiry",
    reason: "First contact within 2 hours",
    description: "Call Jane and use LPMAMA to qualify: Location (Austin), Price ($400k–$600k), Motivation, Agent, Mortgage, Appointment.",
    due_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    priority_bucket: "Do Now",
    context_snapshot: { intent: "buyer", timeline: "30_days", budget: "$400k-$600k" },
  },
  deal_action: "create",
  deal: {
    type: "buyer",
    title: "Jane Smith — Buyer",
    stage: "new",
    motivation: null,
    timeline: "30_days",
  },
};

describe("runChiefOrchestrator", () => {
  beforeEach(() => {
    MockedAnthropic.mockClear();
  });

  it("returns a parsed OrchestratorDecision on success", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validDecision) }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    const result = await runChiefOrchestrator(baseContext);

    expect(result.task_action).toBe("create");
    expect(result.task?.type).toBe("call");
    expect(result.task?.priority_bucket).toBe("Do Now");
    expect(result.deal_action).toBe("create");
  });

  it("passes path-correct system prompt to Claude", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validDecision) }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    await runChiefOrchestrator(baseContext);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain("real_estate");
    expect(callArgs.model).toBe("claude-sonnet-4-6");
  });

  it("returns a safe fallback task when Claude API throws", async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error("API timeout"));
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    const result = await runChiefOrchestrator(baseContext);

    expect(result.task_action).toBe("create");
    expect(result.task?.type).toBe("follow_up");
    expect(result.task?.priority_bucket).toBe("Upcoming");
    expect(result.deal_action).toBe("none");
  });

  it("returns a safe fallback task when Claude returns malformed JSON", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "Here is my analysis: { broken json" }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    const result = await runChiefOrchestrator(baseContext);

    expect(result.task_action).toBe("create");
    expect(result.task?.type).toBe("follow_up");
  });

  it("uses wholesaler path when context.path is wholesaler", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ ...validDecision, task_action: "none", task_reason: "no motivation signals", deal_action: "none" }) }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    await runChiefOrchestrator({ ...baseContext, path: "wholesaler" });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain("wholesaler");
    expect(callArgs.system).toContain("motivation gate");
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx jest src/lib/orchestrator/__tests__/index.test.ts --no-coverage 2>&1 | tail -20
```

Expected: Cannot find module `../index`

- [ ] **Step 3: Create `src/lib/orchestrator/index.ts`**

```ts
// src/lib/orchestrator/index.ts
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildContextMessage } from "./prompt";
import type { OrchestratorContext, OrchestratorDecision } from "./types";

const client = new Anthropic();

function fallbackDecision(reason: string): OrchestratorDecision {
  return {
    task_action: "create",
    task_reason: `Fallback — orchestrator unavailable: ${reason}`,
    deal_action: "none",
    task: {
      type: "follow_up",
      title: "Follow up with lead",
      reason: "System fallback task",
      description: "Check in with this lead. The AI orchestrator was unavailable when this lead came in.",
      due_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      priority_bucket: "Upcoming",
      context_snapshot: { fallback: true, reason },
    },
  };
}

function parseDecision(text: string): OrchestratorDecision {
  // Strip any markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned) as OrchestratorDecision;

  // Minimal validation — ensure required top-level fields exist
  if (!parsed.task_action || !parsed.deal_action || !parsed.task_reason) {
    throw new Error("Parsed decision missing required fields");
  }

  return parsed;
}

export async function runChiefOrchestrator(
  context: OrchestratorContext
): Promise<OrchestratorDecision> {
  try {
    const systemPrompt = buildSystemPrompt(context.path);
    const userMessage = buildContextMessage(context);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in response");
    }

    return parseDecision(textBlock.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chief-orchestrator] failed, using fallback", { error: message });
    return fallbackDecision(message);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx jest src/lib/orchestrator/__tests__/index.test.ts --no-coverage 2>&1 | tail -20
```

Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/orchestrator/index.ts src/lib/orchestrator/__tests__/index.test.ts
git commit -m "feat: implement runChiefOrchestrator with Claude API call and fallback"
```

---

## Task 5: Create `applyDecision()`

**Files:**
- Create: `src/lib/orchestrator/apply.ts`

- [ ] **Step 1: Create `src/lib/orchestrator/apply.ts`**

```ts
// src/lib/orchestrator/apply.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrchestratorDecision } from "./types";

export async function applyDecision(
  decision: OrchestratorDecision,
  leadId: string,
  personId: string | null,
  eventId: string,
  agentId: string,
  supabase: SupabaseClient
): Promise<{ recommendation_id: string | null; deal_id: string | null }> {
  let recommendationId: string | null = null;
  let dealId: string | null = null;

  // --- Task ---
  if (decision.task_action === "create" && decision.task) {
    const { data: rec, error: recError } = await supabase
      .from("lead_recommendations")
      .insert({
        agent_id: agentId,
        owner_user_id: agentId,
        lead_id: leadId,
        person_id: personId,
        source_event_id: eventId,
        reason_code: decision.task.type,
        title: decision.task.title,
        description: decision.task.description,
        priority: priorityBucketToLegacy(decision.task.priority_bucket),
        due_at: decision.task.due_at,
        metadata: {
          task_type: decision.task.type,
          priority_bucket: decision.task.priority_bucket,
          reason: decision.task.reason,
          task_reason: decision.task_reason,
          context_snapshot: decision.task.context_snapshot,
        },
      })
      .select("id")
      .single();

    if (!recError && rec?.id) {
      recommendationId = rec.id;
    } else if (recError) {
      console.error("[apply-decision] task insert failed", { error: recError.message });
    }
  }

  // --- Close replaced task ---
  if (
    (decision.task_action === "replace" || decision.task_action === "update") &&
    decision.target_task_id
  ) {
    await supabase
      .from("lead_recommendations")
      .update({
        metadata: {
          closed_reason: decision.closed_reason ?? "replaced_by_newer_task",
          closed_at: new Date().toISOString(),
        },
      })
      .eq("id", decision.target_task_id)
      .eq("agent_id", agentId);
  }

  // --- Deal ---
  if (decision.deal_action === "create" && decision.deal) {
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        agent_id: agentId,
        owner_user_id: agentId,
        lead_id: leadId,
        title: decision.deal.title,
        deal_type: decision.deal.type,
        stage: decision.deal.stage,
        source_event_id: eventId,
        custom_fields: {
          motivation: decision.deal.motivation,
          timeline: decision.deal.timeline,
        },
      })
      .select("id")
      .single();

    if (!dealError && deal?.id) {
      dealId = deal.id;
    } else if (dealError) {
      console.error("[apply-decision] deal insert failed", { error: dealError.message });
    }
  }

  // --- Contact updates ---
  if (decision.contact_updates && leadId) {
    const patch: Record<string, unknown> = {};
    if (decision.contact_updates.contact_type) {
      patch.contact_type = decision.contact_updates.contact_type;
    }
    if (Object.keys(patch).length > 0) {
      await supabase
        .from("leads")
        .update({ ...patch, time_last_updated: new Date().toISOString() })
        .eq("id", leadId)
        .eq("agent_id", agentId);
    }
  }

  return { recommendation_id: recommendationId, deal_id: dealId };
}

function priorityBucketToLegacy(
  bucket: "Do Now" | "At Risk" | "Upcoming"
): "urgent" | "high" | "medium" {
  if (bucket === "Do Now") return "urgent";
  if (bucket === "At Risk") return "high";
  return "medium";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/orchestrator/apply.ts
git commit -m "feat: add applyDecision helper to write orchestrator output to Supabase"
```

---

## Task 6: Wire Into Ingest Route

**Files:**
- Modify: `src/app/api/events/ingest/route.ts`

This is the surgical replacement. Lines 793–823 in the current file contain the `inferRecommendation` call. Replace that entire block.

- [ ] **Step 1: Add imports at the top of the ingest route**

In `src/app/api/events/ingest/route.ts`, add after the existing imports:

```ts
import { runChiefOrchestrator } from "@/lib/orchestrator/index";
import { applyDecision } from "@/lib/orchestrator/apply";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";
```

- [ ] **Step 2: Add a helper to load operator path near the top of the POST handler**

After `const auth = await loadAccessContext(supabase);` succeeds, add:

```ts
// Load operator path from workspace settings
const { data: agentRow } = await supabase
  .from("agents")
  .select("settings")
  .eq("id", auth.context.user.id)
  .maybeSingle();

const workspaceSettings = readWorkspaceSettingsFromAgentSettings(agentRow?.settings);
const operatorPath = workspaceSettings.operator_path;
```

- [ ] **Step 3: Replace the `inferRecommendation` block**

Find and delete lines 793–823 (the `inferRecommendation` call and the `lead_recommendations` insert block):

```ts
// DELETE THIS ENTIRE BLOCK:
let recommendationId: string | null = null;
const recommendation = inferRecommendation({
  eventType,
  intentType,
  timelineWindow,
  messageText,
});

if (recommendation) {
  const { data: recommendationRow, error: recommendationError } = await supabase
    .from("lead_recommendations")
    .insert({ ... })
    .select("id")
    .single();

  if (!recommendationError && recommendationRow?.id) {
    recommendationId = recommendationRow.id;
  }
}
```

Replace with:

```ts
// Detect preferred channel from form/event data
const preferredChannel = (() => {
  const raw = optionalString(body.normalized_payload?.preferred_channel as unknown) ||
              optionalString(body.raw_payload?.preferred_channel as unknown);
  if (raw === "call" || raw === "text" || raw === "email") return raw;
  return null;
})();

const decision = await runChiefOrchestrator({
  lead: {
    id: leadId,
    full_name: optionalString(identity?.full_name),
    stage: "New",
    source,
    created_at: occurredAt,
  },
  event: {
    type: eventType,
    channel: optionalString(body.channel),
    message_text: messageText,
  },
  contact: {
    has_phone: Boolean(canonicalPhone),
    has_email: Boolean(canonicalEmail),
    preferred_channel: preferredChannel,
  },
  intent: {
    intent_type: intentType,
    timeline_window: timelineWindow,
    location_interest: locationInterest,
    budget_min: budgetMin,
    budget_max: budgetMax,
    property_address: optionalString(body.intent?.property_address as unknown),
  },
  path: operatorPath,
  open_tasks: [],
});

const { recommendation_id: recommendationId } = await applyDecision(
  decision,
  leadId,
  personId,
  eventRow.id,
  auth.context.user.id,
  supabase
);
```

- [ ] **Step 4: Delete the now-unused `inferRecommendation` function**

Remove the entire `inferRecommendation` function (lines 312–343 in the original file) and the `RecommendationDraft` type (lines 49–56) — `applyDecision` handles the DB write now.

- [ ] **Step 5: Verify TypeScript compiles with no errors**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/events/ingest/route.ts
git commit -m "feat: wire Chief Orchestrator into event ingest pipeline, remove inferRecommendation"
```

---

## Task 7: End-to-End Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/kieferfrazier/dev/ig-social-crm && npm run dev 2>&1 &
sleep 5
```

- [ ] **Step 2: Submit a test form event via curl**

First get your auth token from a logged-in browser session (copy from DevTools → Network → any API call → Authorization header). Then:

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "event_type": "form_submission",
    "source": "test",
    "channel": "website",
    "identity": {
      "full_name": "Test Buyer",
      "phone": "5551234567",
      "email": "test@example.com"
    },
    "intent": {
      "intent_type": "buyer",
      "timeline_window": "30_days"
    },
    "message_text": "I am looking to buy a house in Austin in the next 30 days, budget around $500k"
  }'
```

Expected response:
```json
{
  "ok": true,
  "deduped": false,
  "event_id": "...",
  "lead_id": "...",
  "recommendation_id": "..."
}
```

- [ ] **Step 3: Verify the task in Supabase**

```bash
# Check lead_recommendations for the new task
# Open Supabase dashboard → lead_recommendations → sort by created_at desc
# Confirm: priority_bucket is in metadata, task title reflects buyer intent, due_at is ~2 hours from now
```

- [ ] **Step 4: Test wholesaler path (0 motivation signals)**

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "event_type": "form_submission",
    "source": "test",
    "channel": "website",
    "identity": {
      "full_name": "Cold Seller",
      "email": "cold@example.com"
    },
    "intent": {
      "intent_type": "seller"
    },
    "message_text": "Just browsing, not sure if I want to sell yet"
  }'
```

Expected: recommendation has `priority: "medium"` (Upcoming), no `Do Now` task. The metadata should show `priority_bucket: "Upcoming"`.

Note: The path used depends on what `operator_path` is set to in the agent's workspace settings. To test wholesaler behavior, temporarily set `operator_path: "wholesaler"` for the test account via Supabase directly.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: end-to-end smoke test of Chief Orchestrator via event ingest"
```

---

## Success Criteria Checklist

Before calling this complete, verify all of the following:

- [ ] Form submission triggers `runChiefOrchestrator()` end-to-end without errors
- [ ] Real estate buyer lead → `call` task (or `email` if phone absent), `Do Now`, due ~2h
- [ ] Real estate seller lead with address → `prepare_cma` task, `Do Now`, due ~4h
- [ ] Wholesaler lead, 0 signals → `follow_up`, `Upcoming`, due 24h–30d
- [ ] Wholesaler lead, 3+ signals → `call`, `Do Now`, due ~2h
- [ ] API failure → fallback `follow_up` task created, pipeline does not throw
- [ ] TypeScript compiles with zero errors
- [ ] All unit tests pass
