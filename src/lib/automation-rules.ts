import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessContext } from "@/lib/access-context";
import { ownerFilter } from "@/lib/access-context";
import { withReminderOwnerColumn } from "@/lib/reminders";

export type AutomationRule = {
  id: string;
  trigger_event: "lead_created";
  enabled: boolean;
  condition_stage: string | null;
  condition_lead_temp: string | null;
  delay_hours: number;
  reminder_note: string | null;
};

export type LeadForAutomation = {
  id: string;
  ig_username: string | null;
  stage: string | null;
  lead_temp: string | null;
};

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function matchesRule(rule: AutomationRule, lead: LeadForAutomation): boolean {
  if (rule.condition_stage && normalize(rule.condition_stage) !== normalize(lead.stage)) return false;
  if (rule.condition_lead_temp && normalize(rule.condition_lead_temp) !== normalize(lead.lead_temp)) return false;
  return true;
}

export async function listActiveLeadCreatedRules(
  admin: SupabaseClient,
  context: AccessContext
): Promise<AutomationRule[]> {
  const { data, error } = await admin
    .from("automation_rules")
    .select("id,trigger_event,enabled,condition_stage,condition_lead_temp,delay_hours,reminder_note")
    .or(ownerFilter(context, "owner_user_id"))
    .eq("trigger_event", "lead_created")
    .eq("enabled", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[automation] failed to load rules", error.message);
    return [];
  }
  return (data || []) as AutomationRule[];
}

export async function applyLeadCreatedRules(
  admin: SupabaseClient,
  context: AccessContext,
  lead: LeadForAutomation,
  rules: AutomationRule[]
): Promise<void> {
  for (const rule of rules) {
    if (!matchesRule(rule, lead)) continue;
    const preset = `auto_${rule.id.slice(0, 8)}`;

    const { data: existing, error: existingError } = await admin
      .from("follow_up_reminders")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("status", "pending")
      .eq("preset", preset)
      .limit(1);

    if (existingError) {
      console.error("[automation] failed to check existing reminder", existingError.message);
      continue;
    }
    if ((existing || []).length > 0) continue;

    const dueAt = new Date(Date.now() + Math.max(1, rule.delay_hours) * 3600_000).toISOString();
    const note = rule.reminder_note?.trim()
      ? rule.reminder_note
      : `Automated follow-up for @${lead.ig_username || "lead"}`;

    const { error } = await withReminderOwnerColumn((ownerColumn) =>
      admin.from("follow_up_reminders").insert({
        [ownerColumn]: context.user.id,
        lead_id: lead.id,
        due_at: dueAt,
        status: "pending",
        note,
        preset,
      })
    );

    if (error) {
      console.error("[automation] failed to insert reminder", error.message);
    }
  }
}
