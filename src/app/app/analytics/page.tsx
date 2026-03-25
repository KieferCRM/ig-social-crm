import Link from "next/link";
import { redirect } from "next/navigation";
import KpiCard from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { offMarketStageLabel, pipelineStageTone } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function daysAgo(iso: string | null): number {
  if (!iso) return 999;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 999;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// ─── Types ───────────────────────────────────────────────────────────────────

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

type LeadRow = {
  id: string;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  tags: string[] | null;
  created_at: string | null;
  last_communication_at: string | null;
  next_step: string | null;
};

// ─── Off-market analytics ────────────────────────────────────────────────────

function OffMarketAnalytics({
  deals,
  agentTimezone,
}: {
  deals: DealRow[];
  agentTimezone: string;
}) {
  const activeDeals = deals.filter((d) => d.stage !== "closed" && d.stage !== "dead");
  const closedDeals = deals.filter((d) => d.stage === "closed");
  const deadDeals = deals.filter((d) => d.stage === "dead");
  const underContract = deals.filter((d) => d.stage === "under_contract");
  const monthStart = startOfMonth();
  const newThisMonth = deals.filter(
    (d) => d.created_at && d.created_at >= monthStart
  ).length;

  const totalRevenue = closedDeals.reduce((sum, d) => sum + (d.price ?? 0), 0);
  const avgDaysToClose =
    closedDeals.length > 0
      ? Math.round(
          closedDeals.reduce((sum, d) => {
            const ref = d.stage_entered_at || d.updated_at;
            if (!ref) return sum;
            return sum + daysAgo(ref);
          }, 0) / closedDeals.length
        )
      : null;

  const todayStr = new Date().toLocaleDateString("en-CA", {
    timeZone: agentTimezone,
  });
  const overdueFollowups = activeDeals.filter(
    (d) => d.next_followup_date && d.next_followup_date < todayStr
  );
  const noFollowup = activeDeals.filter((d) => !d.next_followup_date);

  const STAGES = [
    "prospecting",
    "offer_sent",
    "negotiating",
    "under_contract",
    "closed",
    "dead",
  ] as const;
  const stageCount: Record<string, number> = {};
  const stageVolume: Record<string, number> = {};
  for (const deal of deals) {
    const stage = deal.stage || "prospecting";
    stageCount[stage] = (stageCount[stage] || 0) + 1;
    if (deal.price) stageVolume[stage] = (stageVolume[stage] || 0) + deal.price;
  }

  const tagCount: Record<string, number> = {};
  for (const deal of deals) {
    for (const tag of deal.tags || []) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const decidedDeals = closedDeals.length + deadDeals.length;
  const winRate =
    decidedDeals > 0
      ? Math.round((closedDeals.length / decidedDeals) * 100)
      : null;

  return (
    <div className="crm-stack-12">
      <section className="crm-kpi-grid crm-dashboard-kpi-grid">
        <KpiCard label="Total Deals" value={deals.length} tone="default" compact />
        <KpiCard label="Active" value={activeDeals.length} tone="ok" compact />
        <KpiCard label="Under Contract" value={underContract.length} tone="warn" compact />
        <KpiCard label="Closed" value={closedDeals.length} tone="ok" compact />
        <KpiCard label="New This Month" value={newThisMonth} tone="default" compact />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Financial</h2>
          <div className="crm-stack-8">
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                Closed Volume
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {totalRevenue > 0 ? formatCurrency(totalRevenue) : "—"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                across {closedDeals.length} closed deal
                {closedDeals.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                Win Rate
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {winRate !== null ? `${winRate}%` : "—"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                {decidedDeals} decided ({closedDeals.length} closed,{" "}
                {deadDeals.length} dead)
              </div>
            </div>
            {avgDaysToClose !== null && (
              <div className="crm-card-muted" style={{ padding: 14 }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                  Avg. Days to Close
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{avgDaysToClose}d</div>
              </div>
            )}
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Follow-up Health</h2>
          <div className="crm-stack-8">
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                Overdue Follow-ups
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: overdueFollowups.length > 0 ? "var(--danger)" : "inherit",
                }}
              >
                {overdueFollowups.length}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color:
                    overdueFollowups.length > 0 ? "var(--danger)" : "var(--ink-muted)",
                  marginTop: 4,
                }}
              >
                {overdueFollowups.length > 0 ? "Deals need a touch today" : "All caught up"}
              </div>
            </div>
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                No Follow-up Set
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: noFollowup.length > 0 ? "var(--warn)" : "inherit",
                }}
              >
                {noFollowup.length}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                Active deals without a follow-up date
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="crm-card crm-section-card crm-stack-10">
        <h2 className="crm-section-title">Stage Breakdown</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {STAGES.map((stage) => (
            <div key={stage} className="crm-card-muted" style={{ padding: 14 }}>
              <StatusBadge
                label={offMarketStageLabel(stage)}
                tone={pipelineStageTone(stage)}
              />
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>
                {stageCount[stage] || 0}
              </div>
              {stageVolume[stage] ? (
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                  {formatCurrency(stageVolume[stage])}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {topTags.length > 0 && (
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Top Tags</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topTags.map(([tag, count]) => (
              <div
                key={tag}
                className="crm-card-muted"
                style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{tag}</span>
                <span className="crm-chip" style={{ fontSize: 11 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Traditional analytics ───────────────────────────────────────────────────

function TraditionalAnalytics({ leads }: { leads: LeadRow[] }) {
  const monthStart = startOfMonth();
  const newThisMonth = leads.filter(
    (l) => l.created_at && l.created_at >= monthStart
  ).length;

  const hot = leads.filter((l) => l.lead_temp === "Hot").length;
  const warm = leads.filter((l) => l.lead_temp === "Warm").length;
  const cold = leads.filter((l) => l.lead_temp === "Cold").length;

  // Stage distribution
  const stageCount: Record<string, number> = {};
  for (const lead of leads) {
    const s = lead.stage || "New";
    stageCount[s] = (stageCount[s] || 0) + 1;
  }
  const LEAD_STAGES = ["New", "Contacted", "Qualified", "Closed"];

  // Source breakdown
  const sourceCount: Record<string, number> = {};
  for (const lead of leads) {
    const src = lead.source || "unknown";
    sourceCount[src] = (sourceCount[src] || 0) + 1;
  }
  const topSources = Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Follow-up health
  const needsContact = leads.filter(
    (l) =>
      l.stage !== "Closed" &&
      (!l.last_communication_at || daysAgo(l.last_communication_at) > 7)
  ).length;
  const noNextStep = leads.filter(
    (l) => l.stage !== "Closed" && !l.next_step
  ).length;

  // Tag breakdown
  const tagCount: Record<string, number> = {};
  for (const lead of leads) {
    for (const tag of lead.tags || []) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const closedLeads = leads.filter((l) => l.stage === "Closed").length;
  const conversionRate =
    leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : null;

  const TEMP_TONE: Record<string, "ok" | "warn" | "default"> = {
    Hot: "ok",
    Warm: "warn",
    Cold: "default",
  };

  return (
    <div className="crm-stack-12">
      <section className="crm-kpi-grid crm-dashboard-kpi-grid">
        <KpiCard label="Total Leads" value={leads.length} tone="default" compact />
        <KpiCard label="New This Month" value={newThisMonth} tone="ok" compact />
        <KpiCard label="Hot Leads" value={hot} tone="ok" compact />
        <KpiCard label="Past Clients" value={closedLeads} tone="ok" compact />
        {conversionRate !== null && (
          <KpiCard label="Conversion Rate" value={`${conversionRate}%`} tone="default" compact />
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Lead Temperature</h2>
          <div className="crm-stack-8">
            {(["Hot", "Warm", "Cold"] as const).map((temp) => {
              const count = temp === "Hot" ? hot : temp === "Warm" ? warm : cold;
              const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
              return (
                <div key={temp} className="crm-card-muted" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <StatusBadge label={temp} tone={TEMP_TONE[temp]} />
                    <span style={{ fontSize: 22, fontWeight: 700 }}>{count}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      height: 4,
                      borderRadius: 2,
                      background: "var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background:
                          temp === "Hot"
                            ? "var(--ok, #16a34a)"
                            : temp === "Warm"
                            ? "var(--warn, #d97706)"
                            : "var(--ink-faint)",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                    {pct}% of total
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Follow-up Health</h2>
          <div className="crm-stack-8">
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                No contact in 7+ days
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: needsContact > 0 ? "var(--danger)" : "inherit",
                }}
              >
                {needsContact}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: needsContact > 0 ? "var(--danger)" : "var(--ink-muted)",
                  marginTop: 4,
                }}
              >
                {needsContact > 0 ? "Leads going cold" : "All recently touched"}
              </div>
            </div>
            <div className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
                No Next Step Set
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: noNextStep > 0 ? "var(--warn)" : "inherit",
                }}
              >
                {noNextStep}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                Open leads without a next action
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="crm-card crm-section-card crm-stack-10">
        <h2 className="crm-section-title">Stage Breakdown</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {LEAD_STAGES.map((stage) => (
            <div key={stage} className="crm-card-muted" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                {stage === "Closed" ? "Past Client" : stage}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
                {stageCount[stage] || 0}
              </div>
            </div>
          ))}
        </div>
      </section>

      {topSources.length > 0 && (
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Lead Sources</h2>
          <div className="crm-stack-6">
            {topSources.map(([source, count]) => {
              const pct =
                leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
              return (
                <div key={source} style={{ display: "grid", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                      {source.replace(/_/g, " ")}
                    </span>
                    <span style={{ color: "var(--ink-muted)" }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: "var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "var(--ink-primary, #0ea5e9)",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {topTags.length > 0 && (
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Top Tags</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topTags.map(([tag, count]) => (
              <div
                key={tag}
                className="crm-card-muted"
                style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{tag}</span>
                <span className="crm-chip" style={{ fontSize: 11 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const admin = supabaseAdmin();

  const [agentResult, billingResult] = await Promise.all([
    supabase
      .from("agents")
      .select("settings, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("agents")
      .select("billing_tier, role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const agentRow = agentResult.data;
  const onboarding = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const isOffMarket = onboarding.account_type === "off_market_agent";
  const agentTimezone =
    (agentRow?.timezone as string | null) ?? "America/New_York";

  const billingRow = billingResult.data;
  const isFounder = billingRow?.role === "founder";
  const billingTier = isFounder
    ? "secretary_voice"
    : (billingRow?.billing_tier ?? "core_crm");

  const hasAnalyticsAccess =
    billingTier === "secretary_sms" || billingTier === "secretary_voice";

  if (!hasAnalyticsAccess) {
    return (
      <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
        <section className="crm-card crm-section-card">
          <div className="crm-page-header">
            <div className="crm-page-header-main">
              <h1 className="crm-page-title">Analytics</h1>
              <p className="crm-page-subtitle">
                Pipeline health, lead volume, follow-up metrics, and stage breakdown — all in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Analytics is included in Secretary
          </h2>
          <p style={{ color: "var(--ink-muted)", maxWidth: 420, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Upgrade to the Secretary plan to unlock pipeline health metrics, lead source breakdown,
            follow-up health, and stage conversion data.
          </p>
          <Link href="/app/settings/billing" className="crm-btn crm-btn-primary">
            View plans
          </Link>
        </section>
      </main>
    );
  }

  let dealsData: DealRow[] = [];
  let leadsData: LeadRow[] = [];

  if (isOffMarket) {
    const { data } = await supabase
      .from("deals")
      .select(
        "id,stage,price,stage_entered_at,updated_at,created_at,next_followup_date,tags"
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false });
    dealsData = (data ?? []) as DealRow[];
  } else {
    const { data } = await supabase
      .from("leads")
      .select(
        "id,stage,lead_temp,source,tags,created_at,last_communication_at,next_step"
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false });
    leadsData = (data ?? []) as LeadRow[];
  }

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">
              {isOffMarket ? "Off-Market" : "Traditional"}
            </p>
            <h1 className="crm-page-title">Analytics</h1>
            <p className="crm-page-subtitle">
              {isOffMarket
                ? "Pipeline health, deal volume, financial metrics, and follow-up status."
                : "Lead volume, temperature breakdown, source performance, and follow-up health."}
            </p>
          </div>
          <div>
            <Link
              href={isOffMarket ? "/app/pipeline" : "/app/list"}
              className="crm-btn crm-btn-secondary"
            >
              {isOffMarket ? "Open pipeline" : "Open leads"}
            </Link>
          </div>
        </div>
      </section>

      {isOffMarket ? (
        <OffMarketAnalytics deals={dealsData} agentTimezone={agentTimezone} />
      ) : (
        <TraditionalAnalytics leads={leadsData} />
      )}
    </main>
  );
}
