import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import MergeTool from "./merge-tool";
import ManualLeadForm from "./manual-lead-form";
import LeadListTable, { type LeadListRow } from "./lead-list-table";
export const dynamic = "force-dynamic";

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

  await _searchParams;

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
        }))}
      />
      <ManualLeadForm />
      <LeadListTable leads={rows} />
    </main>
  );
}
