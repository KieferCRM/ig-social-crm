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
- Cold leads never drop — they move to nurture (Upcoming), not dropped.

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
Every lead passes through a motivation gate before a task is assigned.

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
