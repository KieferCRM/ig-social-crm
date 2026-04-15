// src/lib/orchestrator/apply.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrchestratorDecision } from "./types";

export async function applyDecision(
  decision: OrchestratorDecision,
  leadId: string,
  personId: string | null,
  eventId: string | null,
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
