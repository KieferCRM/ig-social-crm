import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { type LeadListRow } from "./lead-list-table";
import LeadWorkspaceClient from "./lead-workspace-client";

export const dynamic = "force-dynamic";

const STAGES = ["New", "Contacted", "Qualified", "Closed"] as const;
const LEAD_TEMPS = ["Cold", "Warm", "Hot"] as const;

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeStage(value: string | null): string {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "new") return "New";
  if (normalized === "contacted") return "Contacted";
  if (normalized === "qualified") return "Qualified";
  if (normalized === "closed") return "Closed";
  return "New";
}

function normalizeLeadTemp(value: string | null): string {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "cold") return "Cold";
  if (normalized === "hot") return "Hot";
  return "Warm";
}

type ReminderRow = { lead_id: string | null };

export default async function LeadListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const params = (await searchParams) || {};
  const stageFilter = asSingle(params.stage);
  const tempFilter = asSingle(params.temp);
  const sourceFilter = asSingle(params.source);
  const searchFilter = asSingle(params.q);
  const followUpFilter = asSingle(params.follow_up);

  const selectedStage =
    STAGES.find((value) => value.toLowerCase() === (stageFilter || "").toLowerCase()) || "all";
  const selectedTemp =
    LEAD_TEMPS.find((value) => value.toLowerCase() === (tempFilter || "").toLowerCase()) || "all";
  const dueOnly = followUpFilter === "due";

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,last_message_preview,time_last_updated,owner_user_id,assignee_user_id,source_detail"
    )
    .eq("agent_id", user.id)
    .order("time_last_updated", { ascending: false });

  const rows = ((data || []) as LeadListRow[]).map((lead) => ({
    ...lead,
    stage: normalizeStage(lead.stage),
    lead_temp: normalizeLeadTemp(lead.lead_temp),
    source_detail:
      lead.source_detail && typeof lead.source_detail === "object" && !Array.isArray(lead.source_detail)
        ? lead.source_detail
        : null,
  }));

  let dueLeadIds: string[] = [];
  if (dueOnly || !error) {
    const nowIso = new Date().toISOString();
    const { data: reminderRows } = await supabase
      .from("follow_up_reminders")
      .select("lead_id")
      .eq("status", "pending")
      .lte("due_at", nowIso);

    dueLeadIds = Array.from(
      new Set(
        ((reminderRows || []) as ReminderRow[])
          .map((reminder) => reminder.lead_id)
          .filter((leadId): leadId is string => Boolean(leadId))
      )
    );
  }

  return (
    <LeadWorkspaceClient
      leads={rows}
      initialFilters={{
        search: searchFilter || "",
        stage: selectedStage,
        temp: selectedTemp,
        source: sourceFilter || "all",
      }}
      followUpDueMode={dueOnly}
      followUpLeadIds={dueLeadIds}
      errorMessage={error ? "Could not load leads. Try refreshing the page." : null}
    />
  );
}
