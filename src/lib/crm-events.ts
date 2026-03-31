/**
 * crm-events.ts
 *
 * Shared helpers for writing unified CRM signals:
 *   - writeLeadRecommendation: writes a follow-up suggestion to lead_recommendations
 *   - writeDealEvent: appends a timeline entry to deal_events
 *
 * Called from all three intake channels (Forms, Secretary, Inbox) so the
 * Today view and deal timeline stay in sync regardless of how a lead arrives.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

// ── lead_recommendations ─────────────────────────────────────────────────────

export type RecommendationPriority = "low" | "medium" | "high" | "urgent";

export type WriteRecommendationInput = {
  admin: AdminClient;
  agentId: string;
  leadId: string;
  dealId?: string | null;
  title: string;
  description?: string | null;
  priority?: RecommendationPriority;
  dueAt?: string | null;
  reasonCode?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Writes a lead_recommendation row unless one is already open for this lead.
 * Safe to call from any channel — idempotent by lead + status=open check.
 */
export async function writeLeadRecommendation(
  input: WriteRecommendationInput
): Promise<void> {
  try {
    const { data: existing } = await input.admin
      .from("lead_recommendations")
      .select("id")
      .eq("lead_id", input.leadId)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (existing) return; // already has an open recommendation

    const dueAt =
      input.dueAt ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // default: tomorrow

    await input.admin.from("lead_recommendations").insert({
      agent_id: input.agentId,
      owner_user_id: input.agentId,
      lead_id: input.leadId,
      person_id: null,
      source_event_id: null,
      reason_code: input.reasonCode ?? "inbound_next_action",
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      due_at: dueAt,
      status: "open",
      metadata: {
        deal_id: input.dealId ?? null,
        ...(input.metadata ?? {}),
      },
    });
  } catch (err) {
    console.warn(
      "[crm-events] writeLeadRecommendation failed",
      err instanceof Error ? err.message : err
    );
  }
}

// ── deal_events ───────────────────────────────────────────────────────────────

export type DealEventType =
  | "form_submitted"
  | "call_inbound"
  | "call_missed"
  | "sms_inbound"
  | "email_received"
  | "document_received"
  | "stage_changed"
  | "note_added"
  | "checklist_seeded"
  | "deal_created";

export type WriteDealEventInput = {
  admin: AdminClient;
  agentId: string;
  dealId: string;
  eventType: DealEventType;
  sourceChannel?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

/**
 * Appends a timeline event to deal_events.
 * Non-blocking: errors are logged but never surfaced to callers.
 */
export async function writeDealEvent(input: WriteDealEventInput): Promise<void> {
  try {
    await input.admin.from("deal_events").insert({
      deal_id: input.dealId,
      agent_id: input.agentId,
      event_type: input.eventType,
      source_channel: input.sourceChannel ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
      created_at: input.createdAt ?? new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      "[crm-events] writeDealEvent failed",
      err instanceof Error ? err.message : err
    );
  }
}
