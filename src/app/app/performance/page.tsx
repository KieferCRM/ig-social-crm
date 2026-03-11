import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type LeadRow = {
  id: string;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  time_last_updated: string | null;
  created_at?: string | null;
  source_detail?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
};

type ReminderRow = {
  id: string;
  status: "pending" | "done" | string;
  due_at: string | null;
  created_at: string | null;
};

type SourceRollup = {
  label: string;
  total: number;
  closed: number;
  hot: number;
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

function normalize(value: string | null | undefined, fallback = ""): string {
  return (value || fallback).trim().toLowerCase();
}

function prettyLabel(value: string | null | undefined, fallback: string): string {
  const text = (value || "").trim();
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function safeDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function findNumericInRecord(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const parsed = parseNumberish(record[key]);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
}

function numberFromLead(lead: LeadRow, keys: string[]): number | null {
  const source = asRecord(lead.source_detail);
  if (source) {
    const parsed = findNumericInRecord(source, keys);
    if (parsed !== null) return parsed;
  }
  const custom = asRecord(lead.custom_fields);
  if (custom) {
    const parsed = findNumericInRecord(custom, keys);
    if (parsed !== null) return parsed;
  }
  return null;
}

function sourceLabel(raw: string | null): string {
  const value = normalize(raw, "unknown");
  if (value === "ig" || value.includes("instagram")) return "Instagram";
  if (value === "fb" || value.includes("facebook")) return "Facebook";
  if (value.includes("fub") || value.includes("follow_up_boss")) return "Follow Up Boss Import";
  if (value.includes("import")) return "CSV Import";
  if (value.includes("intake") || value.includes("webform") || value.includes("website")) return "Intake Form";
  if (value === "manual") return "Direct Entry";
  if (value === "phone" || value.includes("sms") || value.includes("text")) return "Phone / SMS";
  if (value === "email") return "Email";
  return prettyLabel(raw, "Unknown");
}

async function loadLeadRows(): Promise<{ rows: LeadRow[]; error: string | null }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const selections = [
    "id,stage,lead_temp,source,time_last_updated,created_at,source_detail,custom_fields",
    "id,stage,lead_temp,source,time_last_updated,created_at,source_detail",
    "id,stage,lead_temp,source,time_last_updated,source_detail",
  ];

  let finalError: string | null = null;
  for (const select of selections) {
    const { data, error } = await supabase
      .from("leads")
      .select(select)
      .eq("agent_id", user.id);

    if (!error) {
      return { rows: ((data || []) as LeadRow[]), error: null };
    }
    finalError = error.message;
  }

  return { rows: [], error: finalError || "Could not load lead performance data." };
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <article className="crm-kpi-card">
      <div className="crm-kpi-label">{label}</div>
      <div className="crm-kpi-value">{value}</div>
      {helper ? <div className="crm-kpi-helper">{helper}</div> : null}
    </article>
  );
}

export default async function PerformancePage() {
  const { rows: leads, error: leadError } = await loadLeadRows();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: remindersData } = await supabase
    .from("reminders")
    .select("id,status,due_at,created_at")
    .eq("agent_id", user.id);
  const reminders = (remindersData || []) as ReminderRow[];

  const totalLeads = leads.length;
  const closedLeads = leads.filter((lead) => normalize(lead.stage) === "closed");
  const activeLeads = leads.filter((lead) => normalize(lead.stage) !== "closed");
  const closeRate = totalLeads > 0 ? closedLeads.length / totalLeads : 0;

  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  const closedThisMonth = closedLeads.filter((lead) => {
    const ms = safeDateMs(lead.time_last_updated);
    return ms !== null && ms >= monthStartMs;
  }).length;

  const commissionValues = closedLeads
    .map((lead) =>
      numberFromLead(lead, [
        "commission",
        "commission_amount",
        "gross_commission",
        "commission_estimate",
      ])
    )
    .filter((value): value is number => value !== null && value > 0);
  const averageCommission =
    commissionValues.length > 0
      ? commissionValues.reduce((sum, value) => sum + value, 0) / commissionValues.length
      : null;

  const pipelineValues = activeLeads
    .map((lead) =>
      numberFromLead(lead, [
        "deal_value",
        "estimated_value",
        "pipeline_value",
        "price",
        "estimated_price",
        "budget_max",
      ])
    )
    .filter((value): value is number => value !== null && value > 0);
  const estimatedPipelineValue =
    pipelineValues.length > 0
      ? pipelineValues.reduce((sum, value) => sum + value, 0)
      : null;
  const projectedValue =
    estimatedPipelineValue !== null && closeRate > 0
      ? estimatedPipelineValue * closeRate
      : null;

  const funnel = [
    { key: "new", label: "New", count: leads.filter((lead) => normalize(lead.stage, "new") === "new").length },
    {
      key: "contacted",
      label: "Contacted",
      count: leads.filter((lead) => normalize(lead.stage) === "contacted").length,
    },
    {
      key: "warm",
      label: "Warm",
      count: leads.filter((lead) => normalize(lead.stage) !== "closed" && normalize(lead.lead_temp) === "warm").length,
    },
    {
      key: "hot",
      label: "Hot",
      count: leads.filter((lead) => normalize(lead.stage) !== "closed" && normalize(lead.lead_temp) === "hot").length,
    },
    { key: "closed", label: "Closed", count: closedLeads.length },
  ];
  const maxFunnelCount = Math.max(...funnel.map((step) => step.count), 1);

  const closeDurationsDays = closedLeads
    .map((lead) => {
      const createdMs = safeDateMs(lead.created_at || null);
      const closedMs = safeDateMs(lead.time_last_updated);
      if (createdMs === null || closedMs === null || closedMs <= createdMs) return null;
      return (closedMs - createdMs) / (24 * 3600_000);
    })
    .filter((value): value is number => value !== null);
  const averageDaysToClose =
    closeDurationsDays.length > 0
      ? closeDurationsDays.reduce((sum, value) => sum + value, 0) / closeDurationsDays.length
      : null;

  const activeUpdatedLast24h = activeLeads.filter((lead) => {
    const ms = safeDateMs(lead.time_last_updated);
    return ms !== null && ms >= now - 24 * 3600_000;
  }).length;
  const responseFreshness =
    activeLeads.length > 0 ? activeUpdatedLast24h / activeLeads.length : null;

  const remindersDone = reminders.filter((item) => normalize(item.status) === "done").length;
  const remindersPending = reminders.filter((item) => normalize(item.status) === "pending").length;
  const reminderCompletion =
    remindersDone + remindersPending > 0
      ? remindersDone / (remindersDone + remindersPending)
      : null;
  const overduePending = reminders.filter((item) => {
    if (normalize(item.status) !== "pending") return false;
    const dueMs = safeDateMs(item.due_at);
    return dueMs !== null && dueMs < now;
  }).length;

  const sourceMap = new Map<string, SourceRollup>();
  for (const lead of leads) {
    const label = sourceLabel(lead.source);
    const current = sourceMap.get(label) || { label, total: 0, closed: 0, hot: 0 };
    current.total += 1;
    if (normalize(lead.stage) === "closed") current.closed += 1;
    if (normalize(lead.lead_temp) === "hot" && normalize(lead.stage) !== "closed") current.hot += 1;
    sourceMap.set(label, current);
  }
  const sourceRows = Array.from(sourceMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const strongestSource = sourceRows
    .filter((row) => row.total >= 2)
    .sort((a, b) => b.closed / b.total - a.closed / a.total)[0] || null;

  let biggestDropOff: { from: string; to: string; drop: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const previous = funnel[i - 1];
    const current = funnel[i];
    const drop = previous.count - current.count;
    if (drop <= 0) continue;
    if (!biggestDropOff || drop > biggestDropOff.drop) {
      biggestDropOff = { from: previous.label, to: current.label, drop };
    }
  }

  const guidance: string[] = [];
  if (strongestSource) {
    guidance.push(
      `${strongestSource.label} is your strongest converter right now (${PERCENT.format(
        strongestSource.closed / strongestSource.total
      )} close rate). Double down on that intake path.`
    );
  }
  if (biggestDropOff) {
    guidance.push(
      `Largest pipeline drop is ${biggestDropOff.from} → ${biggestDropOff.to} (${biggestDropOff.drop} leads). Tighten follow-up scripts at this handoff.`
    );
  }
  if (overduePending > 0) {
    guidance.push(
      `${overduePending} follow-up reminder(s) are overdue. Clearing that backlog is the fastest path to improving close rate.`
    );
  }
  if (averageCommission === null) {
    guidance.push(
      "Commission/value fields are mostly empty. Add deal value or commission details to unlock revenue forecasting."
    );
  }
  if (guidance.length === 0) {
    guidance.push(
      "Performance signals are healthy. Keep response speed high and continue prioritizing hot leads."
    );
  }

  return (
    <main className="crm-page" style={{ maxWidth: 1280, display: "grid", gap: 12 }}>
      {leadError ? (
        <section className="crm-card" style={{ padding: 12 }}>
          <div className="crm-chip crm-chip-danger">Could not load full lead analytics.</div>
          <div style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: 13 }}>{leadError}</div>
        </section>
      ) : null}

      <section className="crm-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Revenue / Deal Snapshot</div>
          <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>Performance overview for solo growth decisions</div>
        </div>
        <div className="crm-kpi-grid" style={{ marginTop: 10 }}>
          <MetricCard label="Deals Closed (Month)" value={String(closedThisMonth)} />
          <MetricCard label="Deals Closed (All Time)" value={String(closedLeads.length)} />
          <MetricCard
            label="Avg Commission / Deal"
            value={averageCommission !== null ? CURRENCY.format(averageCommission) : "No data yet"}
            helper={averageCommission === null ? "Add commission fields to closed deals" : undefined}
          />
          <MetricCard
            label="Estimated Pipeline Value"
            value={estimatedPipelineValue !== null ? CURRENCY.format(estimatedPipelineValue) : "No data yet"}
            helper={estimatedPipelineValue === null ? "Capture value fields in lead records" : undefined}
          />
          <MetricCard
            label="Projected Value"
            value={projectedValue !== null ? CURRENCY.format(projectedValue) : "No data yet"}
            helper={projectedValue === null ? "Requires close rate + value data" : undefined}
          />
        </div>
      </section>

      <section className="crm-dashboard-main-columns">
        <section className="crm-card crm-dashboard-primary-card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Conversion Funnel</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-muted)" }}>
            New → Contacted → Warm → Hot → Closed
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {funnel.map((step, index) => {
              const previous = index > 0 ? funnel[index - 1].count : totalLeads;
              const stepConversion = previous > 0 ? step.count / previous : null;
              const relativeWidth = `${Math.max(10, Math.round((step.count / maxFunnelCount) * 100))}%`;
              return (
                <div key={step.key} className="crm-card-muted" style={{ padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700 }}>{step.label}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      {step.count} lead(s)
                      {stepConversion !== null ? ` • ${PERCENT.format(stepConversion)} from previous` : ""}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(38,50,65,0.45)" }}>
                    <div
                      style={{
                        width: relativeWidth,
                        height: "100%",
                        borderRadius: 999,
                        background: "linear-gradient(90deg, rgba(34,197,94,0.75), rgba(22,163,74,0.95))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="crm-card crm-dashboard-secondary-card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Performance Metrics</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Close Rate</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{PERCENT.format(closeRate)}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Average Days to Close</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>
                {averageDaysToClose !== null ? `${Math.round(averageDaysToClose)} days` : "Not enough data"}
              </div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Response Freshness (24h)</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>
                {responseFreshness !== null ? PERCENT.format(responseFreshness) : "No active leads"}
              </div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Follow-up Completion</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>
                {reminderCompletion !== null ? PERCENT.format(reminderCompletion) : "No reminders yet"}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                {overduePending} overdue • {remindersPending} pending
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="crm-dashboard-main-columns">
        <section className="crm-card crm-dashboard-secondary-card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Source / Channel Intelligence</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-muted)" }}>
            Which lead sources are driving pipeline and closes
          </div>

          {sourceRows.length === 0 ? (
            <div className="crm-empty-state" style={{ marginTop: 10 }}>
              <div className="crm-empty-state-title">No source data yet</div>
              <div className="crm-empty-state-body">
                As leads are captured via intake or import, source conversion insights will appear here.
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {sourceRows.map((row) => {
                const conversion = row.total > 0 ? row.closed / row.total : 0;
                return (
                  <div key={row.label} className="crm-card-muted" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{row.label}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        {row.total} leads • {row.closed} closed • {row.hot} hot
                      </div>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                      Conversion: {PERCENT.format(conversion)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="crm-card crm-dashboard-primary-card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Merlyn Guidance</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-muted)" }}>
            Practical coaching based on your current pipeline behavior
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {guidance.map((item, index) => (
              <div key={`${index}-${item.slice(0, 18)}`} className="crm-card-muted" style={{ padding: 10 }}>
                <div style={{ fontSize: 13 }}>{item}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
