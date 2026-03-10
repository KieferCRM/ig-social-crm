import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import MergeTool from "./merge-tool";
import ManualLeadForm from "./manual-lead-form";
import LeadListTable, { type LeadListRow } from "./lead-list-table";
export const dynamic = "force-dynamic";

function firstParam(
  source: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = source[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ListViewPage({
  searchParams: _searchParams,
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

  const params: Record<string, string | string[] | undefined> = (await _searchParams) || {};
  const requestedStage = firstParam(params, "stage");
  const requestedTemp = firstParam(params, "temp");
  const requestedSource = firstParam(params, "source");
  const requestedSearch = firstParam(params, "q");
  const followUpDueMode = firstParam(params, "follow_up") === "due";

  let query = supabase
    .from("leads")
    .select("id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,last_message_preview,time_last_updated,owner_user_id,assignee_user_id,source_detail")
    .order("time_last_updated", { ascending: false });

  // Solo mode: always owner-scoped.
  query = query.eq("agent_id", user.id);

  const { data: leads, error } = await query;

  const rows = ((leads || []) as LeadListRow[]).map((lead) => ({
    ...lead,
    source_detail:
      lead.source_detail && typeof lead.source_detail === "object" && !Array.isArray(lead.source_detail)
        ? lead.source_detail
        : null,
  }));

  let dueFollowUpLeadIds: string[] = [];
  if (followUpDueMode) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const { data: reminders } = await supabase
      .from("reminders")
      .select("lead_id")
      .eq("agent_id", user.id)
      .eq("status", "pending")
      .lte("due_at", endOfToday.toISOString());

    dueFollowUpLeadIds = Array.from(
      new Set((reminders || []).map((item) => item.lead_id).filter((leadId): leadId is string => Boolean(leadId)))
    );
  }

  return (
    <main className="crm-page" style={{ maxWidth: 1120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Leads</h1>
          <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>Search, filter, and manage your lead records.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/app/list" className="crm-btn crm-btn-secondary">
            Lead View
          </Link>
          <Link href="/app" className="crm-btn crm-btn-secondary">
            Dashboard
          </Link>
          <Link href="/app/kanban" className="crm-btn crm-btn-primary">
            Pipeline
          </Link>
        </div>
      </div>

      {error ? <div className="crm-chip crm-chip-danger" style={{ marginTop: 16 }}>Could not load leads.</div> : null}

      <MergeTool
        leads={rows.map((lead) => ({
          id: String(lead.id),
          ig_username: lead.ig_username || null,
          full_name: lead.full_name || null,
          first_name: lead.first_name || null,
          last_name: lead.last_name || null,
          canonical_email: lead.canonical_email || null,
          canonical_phone: lead.canonical_phone || null,
          stage: lead.stage || null,
          lead_temp: lead.lead_temp || null,
        }))}
      />
      <ManualLeadForm />
      <LeadListTable
        leads={rows}
        initialFilters={{
          search: requestedSearch || "",
          stage: requestedStage || "all",
          temp: requestedTemp || "all",
          source: requestedSource || "all",
        }}
        followUpDueMode={followUpDueMode}
        followUpLeadIds={dueFollowUpLeadIds}
      />
    </main>
  );
}
