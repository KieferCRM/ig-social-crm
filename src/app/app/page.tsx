import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DashboardPanel from "./dashboard-panel";
import DashboardRightRail from "./dashboard-right-rail";
export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
};

type RecommendationRow = {
  id: string;
  lead_id: string | null;
  person_id: string | null;
  reason_code: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "done" | "dismissed";
  due_at: string | null;
  created_at: string;
};

export default async function AppHome({
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

  const ownerOnly = `agent_id.eq.${user.id}`;

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, ig_username, full_name, first_name, last_name, canonical_email, canonical_phone, stage, lead_temp, source, intent, timeline, last_message_preview, time_last_updated"
    )
    .or(ownerOnly);

  let recommendations: RecommendationRow[] = [];
  const { data: recommendationData, error: recommendationError } = await supabase
    .from("lead_recommendations")
    .select("id, lead_id, person_id, reason_code, title, description, priority, status, due_at, created_at")
    .or(ownerOnly)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!recommendationError) {
    recommendations = (recommendationData || []) as RecommendationRow[];
  }

  const leadRows = (leads || []) as LeadRow[];
  const total = leadRows.length;
  const hot = leadRows.filter((l) => l.lead_temp === "Hot").length;
  const newCount = leadRows.filter((l) => l.stage === "New").length;
  const closed = leadRows.filter((l) => l.stage === "Closed").length;
  const conversion = total > 0 ? Math.round((closed / total) * 1000) / 10 : 0;
  const sortedLeadRows = leadRows
    .slice()
    .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || ""));
  await _searchParams;

  return (
    <main className="crm-dashboard-page">
      {error ? (
        <div className="crm-card" style={{ padding: 12, marginBottom: 12, color: "var(--danger)", fontSize: 14 }}>
          Could not load your dashboard counts.
        </div>
      ) : null}

      <section className="crm-dashboard-grid">
        <div>
          <DashboardPanel
            total={total}
            hot={hot}
            newCount={newCount}
            closed={closed}
            conversion={conversion}
            allLeads={sortedLeadRows}
            recommendations={recommendations}
          />
        </div>

        <aside className="crm-dashboard-rail">
          <DashboardRightRail leads={sortedLeadRows} />
        </aside>
      </section>
    </main>
  );
}
