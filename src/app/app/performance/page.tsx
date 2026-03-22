import Link from "next/link";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import KpiCard from "@/components/ui/kpi-card";
import { offMarketStageLabel, pipelineStageTone } from "@/lib/pipeline";
import { supabaseServer } from "@/lib/supabase/server";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return null;
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function daysInStage(stageEnteredAt: string | null, updatedAt: string | null): number {
  const ref = stageEnteredAt || updatedAt;
  if (!ref) return 0;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

type DealRow = {
  id: string;
  stage: string | null;
  price: number | null;
  stage_entered_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  next_followup_date: string | null;
  tags: string[] | null;
};

export default async function PerformancePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: agentRow }, { data: dealData }] = await Promise.all([
    supabase.from("agents").select("settings, timezone").eq("id", user.id).maybeSingle(),
    supabase
      .from("deals")
      .select("id,stage,price,stage_entered_at,updated_at,created_at,next_followup_date,tags")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const onboarding = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  if (onboarding.account_type !== "off_market_agent") redirect("/app");

  const deals = ((dealData || []) as DealRow[]).filter((d) => asString(d.id));

  const activeDeals = deals.filter((d) => d.stage !== "closed" && d.stage !== "dead");
  const closedDeals = deals.filter((d) => d.stage === "closed");
  const deadDeals = deals.filter((d) => d.stage === "dead");
  const underContract = deals.filter((d) => d.stage === "under_contract");

  const totalRevenue = closedDeals.reduce((sum, d) => sum + (asNumber(d.price) || 0), 0);
  const avgDaysToClose =
    closedDeals.length > 0
      ? Math.round(closedDeals.reduce((sum, d) => sum + daysInStage(d.stage_entered_at, d.updated_at), 0) / closedDeals.length)
      : null;

  const agentTimezone = (agentRow?.timezone as string | null) ?? "America/New_York";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: agentTimezone });
  const overdueFollowups = activeDeals.filter(
    (d) => d.next_followup_date && d.next_followup_date < todayStr
  );
  const noFollowup = activeDeals.filter((d) => !d.next_followup_date);

  // Stage breakdown
  const STAGES = ["prospecting", "offer_sent", "negotiating", "under_contract", "closed", "dead"] as const;
  const stageCount: Record<string, number> = {};
  const stageVolume: Record<string, number> = {};
  for (const deal of deals) {
    const stage = deal.stage || "prospecting";
    stageCount[stage] = (stageCount[stage] || 0) + 1;
    if (asNumber(deal.price)) {
      stageVolume[stage] = (stageVolume[stage] || 0) + (asNumber(deal.price) || 0);
    }
  }

  // Tag breakdown
  const tagCount: Record<string, number> = {};
  for (const deal of deals) {
    for (const tag of deal.tags || []) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Win rate
  const decidedDeals = closedDeals.length + deadDeals.length;
  const winRate = decidedDeals > 0 ? Math.round((closedDeals.length / decidedDeals) * 100) : null;

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Off-Market</p>
            <h1 className="crm-page-title">Performance</h1>
            <p className="crm-page-subtitle">
              A snapshot of your off-market pipeline — volume, stage distribution, and follow-up health.
            </p>
          </div>
          <div>
            <Link href="/app/pipeline" className="crm-btn crm-btn-secondary">Open pipeline</Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="crm-kpi-grid crm-dashboard-kpi-grid">
        <KpiCard label="Total Deals" value={deals.length} tone="default" compact />
        <KpiCard label="Active Deals" value={activeDeals.length} tone="ok" compact />
        <KpiCard label="Under Contract" value={underContract.length} tone="warn" compact />
        <KpiCard label="Closed" value={closedDeals.length} tone="ok" compact />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Revenue + stats */}
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Financial</h2>
          <div className="crm-stack-8">
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>Closed Volume</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{totalRevenue > 0 ? formatCurrency(totalRevenue) : "—"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                across {closedDeals.length} closed deal{closedDeals.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>Win Rate</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {winRate !== null ? `${winRate}%` : "—"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                {decidedDeals} decided ({closedDeals.length} closed, {deadDeals.length} dead)
              </div>
            </div>
            {avgDaysToClose !== null ? (
              <div className="crm-card-muted" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>Avg. Days to Close</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{avgDaysToClose}d</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Follow-up health */}
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Follow-up Health</h2>
          <div className="crm-stack-8">
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>Overdue Follow-ups</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: overdueFollowups.length > 0 ? "var(--danger)" : "inherit" }}>
                {overdueFollowups.length}
              </div>
              {overdueFollowups.length > 0 ? (
                <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>
                  Deals need a touch today
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>All caught up</div>
              )}
            </div>
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>No Follow-up Set</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: noFollowup.length > 0 ? "var(--warn)" : "inherit" }}>
                {noFollowup.length}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                Active deals without a follow-up date
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Stage breakdown */}
      <section className="crm-card crm-section-card crm-stack-10">
        <h2 className="crm-section-title">Stage Breakdown</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {STAGES.map((stage) => (
            <div key={stage} className="crm-card-muted" style={{ padding: 14 }}>
              <StatusBadge label={offMarketStageLabel(stage)} tone={pipelineStageTone(stage)} />
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{stageCount[stage] || 0}</div>
              {stageVolume[stage] ? (
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                  {formatCurrency(stageVolume[stage])}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Tags */}
      {topTags.length > 0 ? (
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Top Tags</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topTags.map(([tag, count]) => (
              <div key={tag} className="crm-card-muted" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{tag}</span>
                <span className="crm-chip" style={{ fontSize: 11 }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
