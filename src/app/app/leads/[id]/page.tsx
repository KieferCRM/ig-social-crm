import { notFound, redirect } from "next/navigation";
import LeadCommandWorkspace, {
  type LeadWorkspaceLead,
  type ReminderPreview,
} from "./lead-command-workspace";
import { withReminderOwnerColumn } from "@/lib/reminders";
import { RECEPTIONIST_SETTINGS_KEY, readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ReminderRow = {
  id: string;
  due_at: string | null;
  status: string | null;
  note?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const selections = [
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,deal_price,commission_percent,commission_amount,close_date,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,created_at,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,deal_price,commission_percent,commission_amount,close_date,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,created_at,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,intent,timeline,next_step,notes,last_message_preview,time_last_updated,last_communication_at,created_at",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,intent,timeline,next_step,notes,last_message_preview,time_last_updated,last_communication_at",
  ];
  const ownerColumns = ["agent_id", "owner_user_id", "assignee_user_id"] as const;

  let data: LeadWorkspaceLead | null = null;
  let finalError: string | null = null;

  for (const select of selections) {
    for (const ownerColumn of ownerColumns) {
      const { data: row, error } = await supabase
        .from("leads")
        .select(select)
        .eq("id", id)
        .eq(ownerColumn, user.id)
        .maybeSingle();

      if (!error) {
        data = (row as LeadWorkspaceLead | null) || null;
        finalError = null;
        if (data) break;
        continue;
      }

      finalError = error.message;
    }
    if (data) break;
  }

  if (finalError || !data) {
    notFound();
  }

  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const agentSettings = asRecord(agentRow?.settings);
  const hasReceptionistSettings = Boolean(
    agentSettings && Object.prototype.hasOwnProperty.call(agentSettings, RECEPTIONIST_SETTINGS_KEY)
  );
  const receptionistSettings = hasReceptionistSettings
    ? readReceptionistSettingsFromAgentSettings(agentRow?.settings || null)
    : null;
  const conciergeEnabled = Boolean(
    receptionistSettings?.receptionist_enabled && receptionistSettings?.communications_enabled
  );

  const { data: reminderData } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .select("id,due_at,status,note")
      .eq(ownerColumn, user.id)
      .eq("lead_id", id)
      .order("due_at", { ascending: true })
      .limit(20)
  );

  const reminders: ReminderPreview[] = ((reminderData || []) as ReminderRow[]).map((item) => ({
    id: item.id,
    due_at: item.due_at || "",
    status: item.status || "pending",
    note: item.note || null,
  }));

  return <LeadCommandWorkspace lead={data} reminders={reminders} conciergeEnabled={conciergeEnabled} />;
}
