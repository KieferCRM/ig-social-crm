import Link from "next/link";
import { redirect } from "next/navigation";
import FormAlertsSection from "@/components/today/FormAlertsSection";
import WelcomeChecklist from "@/components/today/WelcomeChecklist";
import EmptyState from "@/components/ui/empty-state";
import KpiCard from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import {
  dealStageLabel,
  dealStageTone,
  dealTypeLabel,
  leadDisplayName,
  leadTempTone,
  normalizeDealStage,
  normalizeDealType,
  type DealLeadSummary,
} from "@/lib/deals";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import WeekStrip from "@/components/today/WeekStrip";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
  lead_temp: string | null;
  stage: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  location_area: string | null;
  budget_range: string | null;
  notes: string | null;
  time_last_updated: string | null;
};

type RecommendationRow = {
  id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
};

type DealRow = {
  id?: unknown;
  lead_id?: unknown;
  property_address?: unknown;
  price?: unknown;
  stage?: unknown;
  deal_type?: unknown;
  updated_at?: unknown;
  expected_close_date?: unknown;
  next_followup_date?: unknown;
  stage_entered_at?: unknown;
  lead?: DealLeadSummary | DealLeadSummary[];
};

type TodayDeal = {
  id: string;
  leadId: string | null;
  propertyAddress: string | null;
  price: string | number | null;
  stage: ReturnType<typeof normalizeDealStage>;
  dealType: ReturnType<typeof normalizeDealType>;
  updatedAt: string | null;
  expectedCloseDate: string | null;
  nextFollowupDate: string | null;
  stageEnteredAt: string | null;
  lead: DealLeadSummary | null;
};

type TodayAppointment = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  lead: { full_name: string | null } | null;
  deal: { property_address: string | null } | null;
};

type PaDraft = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  lead_id: string | null;
};

type TodayTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_at: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function formatDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString();
}

function formatTimeAgo(value: string | null): string {
  if (!value) return "No recent activity";
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "No recent activity";
  const hours = Math.round((Date.now() - ts) / 3600_000);
  if (hours <= 24) return `${Math.max(hours, 1)}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function isStale(updatedAt: string | null, days: number): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return ts < Date.now() - days * 24 * 3600_000;
}

function mapDealLead(value: DealLeadSummary | DealLeadSummary[] | undefined): DealLeadSummary | null {
  const lead = Array.isArray(value) ? value[0] : value;
  if (!lead || typeof lead !== "object") return null;
  return {
    id: typeof lead.id === "string" ? lead.id : "",
    full_name: typeof lead.full_name === "string" ? lead.full_name : null,
    first_name: typeof lead.first_name === "string" ? lead.first_name : null,
    last_name: typeof lead.last_name === "string" ? lead.last_name : null,
    canonical_email: typeof lead.canonical_email === "string" ? lead.canonical_email : null,
    canonical_phone: typeof lead.canonical_phone === "string" ? lead.canonical_phone : null,
    ig_username: typeof lead.ig_username === "string" ? lead.ig_username : null,
    lead_temp: typeof lead.lead_temp === "string" ? lead.lead_temp : null,
    source: typeof lead.source === "string" ? lead.source : null,
    intent: typeof lead.intent === "string" ? lead.intent : null,
    timeline: typeof lead.timeline === "string" ? lead.timeline : null,
    location_area: typeof lead.location_area === "string" ? lead.location_area : null,
  };
}

function mapDealRow(row: DealRow): TodayDeal | null {
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    leadId: asString(row.lead_id),
    propertyAddress: asString(row.property_address),
    price: typeof row.price === "number" || typeof row.price === "string" ? row.price : null,
    stage: normalizeDealStage(asString(row.stage)),
    dealType: normalizeDealType(asString(row.deal_type)),
    updatedAt: asString(row.updated_at),
    expectedCloseDate: asString(row.expected_close_date),
    nextFollowupDate: asString(row.next_followup_date),
    stageEnteredAt: asString(row.stage_entered_at),
    lead: mapDealLead(row.lead),
  };
}

export default async function AppHome() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  // Fetch agent config first to branch queries by account type
  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings, timezone")
    .eq("id", user.id)
    .maybeSingle();

  const workspaceSettings = readWorkspaceSettingsFromAgentSettings(agentRow?.settings || null);
  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const isOffMarketAccount = onboardingState.account_type === "off_market_agent";
  const agentTimezone = (agentRow?.timezone as string | null) ?? "America/New_York";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: agentTimezone });
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // ── OFF-MARKET BRANCH ──────────────────────────────────────────────────────
  if (isOffMarketAccount) {
    const recommendationOwnerFilter = `owner_user_id.eq.${user.id},agent_id.eq.${user.id}`;

    const [
      { data: dealData },
      { data: formAlertData },
      { data: appointmentData },
      { data: paDraftData },
      { data: taskData },
    ] = await Promise.all([
      supabase
        .from("deals")
        .select(
          "id,lead_id,property_address,price,stage,deal_type,updated_at,expected_close_date,next_followup_date,stage_entered_at,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)"
        )
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("receptionist_alerts")
        .select("id,alert_type,severity,title,message,created_at,metadata")
        .eq("agent_id", user.id)
        .in("alert_type", ["form_submission", "call_inbound"])
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("appointments")
        .select("id,title,scheduled_at,duration_minutes,location,lead:leads(full_name),deal:deals(property_address)")
        .eq("agent_id", user.id)
        .neq("status", "cancelled")
        .gte("scheduled_at", todayStart)
        .lte("scheduled_at", new Date(Date.now() + 56 * 24 * 3600_000).toISOString())
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("receptionist_alerts")
        .select("id,title,message,created_at,metadata,lead_id")
        .eq("agent_id", user.id)
        .eq("alert_type", "pa_reply_draft")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("lead_recommendations")
        .select("id,title,description,priority,due_at")
        .or(recommendationOwnerFilter)
        .eq("status", "open")
        .lte("due_at", new Date(Date.now() + 56 * 24 * 3600_000).toISOString())
        .order("due_at", { ascending: true })
        .limit(40),
    ]);

    const deals = ((dealData || []) as DealRow[])
      .map(mapDealRow)
      .filter((d): d is TodayDeal => Boolean(d));
    const activeDeals = deals.filter((d) => d.stage !== "closed" && d.stage !== "lost" && d.stage !== "dead");
    const staleDeals = activeDeals.filter((d) => isStale(d.updatedAt, 7));
    const followupsDue = activeDeals
      .filter((d) => d.nextFollowupDate && d.nextFollowupDate <= todayStr)
      .sort((a, b) => (a.nextFollowupDate ?? "").localeCompare(b.nextFollowupDate ?? ""));
    const allAppointments = (appointmentData ?? []) as unknown as TodayAppointment[];
    const paDrafts = (paDraftData ?? []) as PaDraft[];
    const allTasks = (taskData ?? []) as TodayTask[];
    const formAlerts = (formAlertData || []) as Array<{ id: string; title: string; message: string; severity: string; created_at: string }>;

    // Date strings for WeekStrip heat map (YYYY-MM-DD in agent timezone)
    const appointmentDateStrings = allAppointments.map((a) =>
      new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: agentTimezone })
    );
    const followupDateStrings = activeDeals
      .filter((d) => d.nextFollowupDate)
      .map((d) => d.nextFollowupDate!);
    const taskDateStrings = allTasks
      .filter((t) => t.due_at)
      .map((t) => new Date(t.due_at!).toLocaleDateString("en-CA", { timeZone: agentTimezone }));

    // Pipeline pulse — stage counts
    const offMarketActiveStages = ["new", "prospecting", "offer_sent", "negotiating", "under_contract", "inspection", "appraisal", "closing"] as const;
    const stageCounts = offMarketActiveStages.map((stage) => ({
      stage,
      label: stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count: activeDeals.filter((d) => d.stage === stage).length,
      stale: staleDeals.filter((d) => d.stage === stage).length,
    })).filter((s) => s.count > 0);

    // Action queue — unified urgency feed
    const overdueDue = followupsDue.filter((d) => d.nextFollowupDate && d.nextFollowupDate < todayStr);
    const dueTodayDeals = followupsDue.filter((d) => d.nextFollowupDate === todayStr);
    const urgentTasks = allTasks.filter((t) => t.due_at && t.due_at <= todayStr && (t.priority === "urgent" || t.priority === "high"));

    return (
      <main className="crm-page crm-page-wide crm-stack-12">
        <FormAlertsSection initialAlerts={formAlerts} title="New Activity" />

        {/* Rolling 7-day week strip */}
        <WeekStrip
          startDate={todayStr}
          appointmentDates={appointmentDateStrings}
          followupDates={followupDateStrings}
          taskDates={taskDateStrings}
          appointments={allAppointments}
        />

        {deals.length === 0 ? (
          <section className="crm-card crm-section-card">
            <EmptyState
              eyebrow="Off-Market workspace"
              title="Your deal command center is ready."
              body="No deals yet. Start with the pipeline, share a seller form, or add a contact."
              action={
                <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Link href="/app/pipeline" className="crm-btn crm-btn-primary">Open pipeline</Link>
                  <Link href="/app/forms" className="crm-btn crm-btn-secondary">Share forms</Link>
                  <Link href="/app/contacts?add=true" className="crm-btn crm-btn-secondary">Add contact</Link>
                </div>
              }
            />
          </section>
        ) : (
          <section className="crm-today-grid">

            {/* LEFT — Pipeline Pulse */}
            <article className="crm-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <h2 className="crm-section-title">Pipeline Pulse</h2>
                <Link href="/app/pipeline" className="crm-btn crm-btn-secondary">Open pipeline</Link>
              </div>
              <div className="crm-stack-6">
                {stageCounts.length === 0 ? (
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>No active deals in pipeline.</div>
                ) : stageCounts.map(({ stage, label, count, stale }) => (
                  <div key={stage} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <div style={{
                        height: 6,
                        borderRadius: 3,
                        background: "var(--brand)",
                        width: `${Math.max(8, (count / activeDeals.length) * 100)}%`,
                        maxWidth: "60%",
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {stale > 0 && (
                        <span style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                          {stale} stale
                        </span>
                      )}
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", minWidth: 20, textAlign: "right" }}>{count}</span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-muted)" }}>Total active</span>
                  <span style={{ fontWeight: 700 }}>{activeDeals.length}</span>
                </div>
              </div>
            </article>

            {/* RIGHT — Action Queue */}
            <article className="crm-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <h2 className="crm-section-title">Action Queue</h2>
                {paDrafts.length > 0 && (
                  <Link href="/app/secretary" className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>
                    {paDrafts.length} Secretary draft{paDrafts.length > 1 ? "s" : ""}
                  </Link>
                )}
              </div>
              <div className="crm-stack-6">
                {overdueDue.length === 0 && dueTodayDeals.length === 0 && staleDeals.length === 0 && urgentTasks.length === 0 ? (
                  <div className="crm-card-muted" style={{ padding: 14, color: "var(--ink-muted)" }}>
                    Queue is clear. No urgent items right now.
                  </div>
                ) : null}
                {overdueDue.map((deal) => (
                  <Link key={deal.id} href="/app/pipeline" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="crm-card-muted" style={{ padding: 12, borderLeft: "3px solid #ef4444", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "Deal"}</span>
                        <StatusBadge label="Overdue" tone="danger" />
                      </div>
                      {deal.lead?.canonical_phone && (
                        <div style={{ fontSize: 12, color: "var(--brand)", marginTop: 4 }}>{deal.lead.canonical_phone}</div>
                      )}
                    </div>
                  </Link>
                ))}
                {dueTodayDeals.map((deal) => (
                  <Link key={deal.id} href="/app/pipeline" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="crm-card-muted" style={{ padding: 12, borderLeft: "3px solid #f59e0b", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "Deal"}</span>
                        <StatusBadge label="Due today" tone="warn" />
                      </div>
                      {deal.lead?.canonical_phone && (
                        <div style={{ fontSize: 12, color: "var(--brand)", marginTop: 4 }}>{deal.lead.canonical_phone}</div>
                      )}
                    </div>
                  </Link>
                ))}
                {urgentTasks.map((task) => (
                  <Link key={task.id} href="/app/priorities" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="crm-card-muted" style={{ padding: 12, borderLeft: "3px solid #6366f1", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</span>
                        <StatusBadge label={task.priority === "urgent" ? "Urgent" : "High"} tone={task.priority === "urgent" ? "danger" : "warn"} />
                      </div>
                    </div>
                  </Link>
                ))}
                {staleDeals.slice(0, 4).map((deal) => (
                  <Link key={deal.id} href="/app/pipeline" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div className="crm-card-muted" style={{ padding: 12, cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "Deal"}</span>
                        <StatusBadge label="Stale" tone="default" />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                        No movement in {formatTimeAgo(deal.updatedAt)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </article>

          </section>
        )}

        <WelcomeChecklist />
      </main>
    );
  }

  // ── SOLO AGENT (TRADITIONAL) BRANCH ─────────────────────────────────────────
  const recommendationOwnerFilter = `owner_user_id.eq.${user.id},agent_id.eq.${user.id}`;

  const [{ data: leadData }, { data: dealData }, { data: recommendationData }, { data: formAlertData }, { data: checklistData }, { data: appointmentData }, { data: taskData }] =
    await Promise.all([
      supabase
        .from("leads")
        .select(
          "id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,stage,source,intent,timeline,location_area,budget_range,notes,time_last_updated"
        )
        .eq("agent_id", user.id)
        .order("time_last_updated", { ascending: false })
        .limit(200),
      supabase
        .from("deals")
        .select(
          "id,lead_id,property_address,price,stage,deal_type,updated_at,expected_close_date,next_followup_date,stage_entered_at,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)"
        )
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("lead_recommendations")
        .select("id,lead_id,title,description,priority,due_at,created_at,metadata")
        .or(recommendationOwnerFilter)
        .eq("status", "open")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("receptionist_alerts")
        .select("id,alert_type,severity,title,message,created_at,metadata")
        .eq("agent_id", user.id)
        .in("alert_type", ["form_submission", "call_inbound"])
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("deal_checklist_items")
        .select("id,deal_id,label,completed")
        .eq("agent_id", user.id),
      supabase
        .from("appointments")
        .select("id,title,scheduled_at,duration_minutes,location,lead:leads(full_name),deal:deals(property_address)")
        .eq("agent_id", user.id)
        .neq("status", "cancelled")
        .gte("scheduled_at", todayStart)
        .lte("scheduled_at", new Date(Date.now() + 56 * 24 * 3600_000).toISOString())
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("lead_recommendations")
        .select("id,due_at")
        .or(recommendationOwnerFilter)
        .eq("status", "open")
        .not("due_at", "is", null)
        .lte("due_at", new Date(Date.now() + 56 * 24 * 3600_000).toISOString()),
    ]);

  const leads = ((leadData || []) as LeadRow[]).filter((lead) => lead.id);
  const deals = ((dealData || []) as DealRow[])
    .map(mapDealRow)
    .filter((deal): deal is TodayDeal => Boolean(deal));
  const recommendations = (recommendationData || []) as RecommendationRow[];
  const formAlerts = (formAlertData || []) as Array<{ id: string; title: string; message: string; severity: string; created_at: string }>;
  const allChecklistItems = (checklistData || []) as Array<{ id: string; deal_id: string; label: string; completed: boolean }>;

  const activeDeals = deals.filter((deal) => deal.stage !== "closed" && deal.stage !== "lost" && deal.stage !== "dead" && deal.stage !== "past_client");
  const hotLeads = leads.filter((lead) => String(lead.lead_temp || "").toLowerCase() === "hot");
  const allAppointments = (appointmentData ?? []) as unknown as TodayAppointment[];
  const appointmentDateStrings = allAppointments.map((a) =>
    new Date(a.scheduled_at).toLocaleDateString("en-CA", { timeZone: agentTimezone })
  );
  const followupDateStrings = activeDeals
    .filter((d) => d.nextFollowupDate)
    .map((d) => d.nextFollowupDate!);
  const taskDateStrings = ((taskData ?? []) as Array<{ id: string; due_at: string | null }>)
    .filter((t) => t.due_at)
    .map((t) => new Date(t.due_at!).toLocaleDateString("en-CA", { timeZone: agentTimezone }));
  const staleDeals = activeDeals.filter((deal) => isStale(deal.updatedAt, 7));
  const trueEmptyWorkspace = leads.length === 0 && deals.length === 0 && recommendations.length === 0;

  // Pipeline health columns — 4 groups agents actually think in
  const PIPELINE_GROUPS = [
    { key: "new_leads",      label: "New Leads",      stages: ["new", "contacted", "attempted_contact"] },
    { key: "showings",       label: "Showings",        stages: ["qualified", "buyer_consultation", "active_search", "showing", "engaging", "listing_appointment", "agreement_signed", "active_listing"] },
    { key: "offers",         label: "Offers",          stages: ["offer_made", "offer_received"] },
    { key: "under_contract", label: "Under Contract",  stages: ["under_contract", "inspection", "appraisal", "closing", "closing_scheduled"] },
  ] as const;

  const pipelineColumns = PIPELINE_GROUPS.map((group) => ({
    ...group,
    deals: activeDeals.filter((d) => (group.stages as readonly string[]).includes(d.stage ?? "")),
  }));

  // Active transactions — under contract deals with checklist progress
  const underContractDeals = activeDeals.filter((d) =>
    (["under_contract", "inspection", "appraisal", "closing", "closing_scheduled"] as string[]).includes(d.stage ?? "")
  );

  const checklistByDeal = new Map<string, { total: number; completed: number }>();
  for (const item of allChecklistItems) {
    const existing = checklistByDeal.get(item.deal_id) ?? { total: 0, completed: 0 };
    checklistByDeal.set(item.deal_id, {
      total: existing.total + 1,
      completed: existing.completed + (item.completed ? 1 : 0),
    });
  }

  // "Who to contact today" — recommendations ranked by urgency, plus hot leads not already listed
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedRecs = [...recommendations].sort(
    (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );
  const attentionRows = sortedRecs.slice(0, 6).map((item) => {
    const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
    const lead = item.lead_id ? leadMap.get(item.lead_id) || null : null;
    return { id: item.id, title: item.title, description: item.description, dueAt: item.due_at, priority: item.priority, lead };
  });
  const hotNow = hotLeads
    .filter((lead) => !attentionRows.some((item) => item.lead?.id === lead.id))
    .slice(0, 2);

  // Buyer vs listing deal counts for KPIs
  const activeBuyers = activeDeals.filter((d) => d.dealType === "buyer");
  const activeListings = activeDeals.filter((d) => d.dealType === "listing");

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <FormAlertsSection initialAlerts={formAlerts} />

      {/* Rolling 7-day week strip */}
      <WeekStrip
        startDate={todayStr}
        appointmentDates={appointmentDateStrings}
        followupDates={followupDateStrings}
        taskDates={taskDateStrings}
        appointments={allAppointments}
      />

      {/* KPI row */}
      <section className="crm-kpi-grid crm-dashboard-kpi-grid">
        <KpiCard
          label="New Leads"
          value={leads.filter((l) => {
            const ts = l.time_last_updated ? new Date(l.time_last_updated).getTime() : 0;
            return ts > Date.now() - 7 * 24 * 3600_000;
          }).length}
          tone="default"
          href="/app/intake"
          compact
        />
        <KpiCard label="Active Buyers" value={activeBuyers.length} tone="ok" href="/app/deals" compact />
        <KpiCard label="Active Listings" value={activeListings.length} tone="ok" href="/app/deals" compact />
        <KpiCard
          label="Under Contract"
          value={underContractDeals.length}
          tone={underContractDeals.length > 0 ? "warn" : "default"}
          href="/app/deals"
          compact
        />
      </section>

      {trueEmptyWorkspace ? (
        <section className="crm-card crm-section-card">
          <EmptyState
            eyebrow="Your Virtual Office"
            title="Your team is ready to go."
            body="No deals or leads yet. Share your intake link to start capturing buyers and sellers automatically."
            action={
              <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link href="/app/intake" className="crm-btn crm-btn-primary">Open Intake Coordinator</Link>
                <Link href="/app/deals" className="crm-btn crm-btn-secondary">Open Pipeline</Link>
              </div>
            }
          />
        </section>
      ) : null}

      {/* Main two-column layout */}
      <section className="crm-today-grid">

        {/* LEFT — Who to Contact Today */}
        <article className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <div>
              <h2 className="crm-section-title">Who to Contact Today</h2>
              <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2, marginBottom: 0 }}>From your Follow-Up Coordinator</p>
            </div>
            <Link href="/app/priorities" className="crm-btn crm-btn-secondary">Full queue</Link>
          </div>
          <div className="crm-stack-8">
            {attentionRows.length === 0 && hotNow.length === 0 ? (
              <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700 }}>You&apos;re caught up</div>
                <div style={{ color: "var(--ink-muted)" }}>
                  Follow-up recommendations surface here as leads come in and deals move forward.
                </div>
              </div>
            ) : null}
            {attentionRows.map((item) => (
              <div key={item.id} className="crm-card-muted crm-ai-panel crm-stack-8" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div className="crm-stack-4">
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    {item.description ? <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{item.description}</div> : null}
                  </div>
                  <StatusBadge
                    label={item.priority === "urgent" ? "Contact now" : item.priority === "high" ? "Today" : "Soon"}
                    tone={item.priority === "urgent" ? "danger" : item.priority === "high" ? "warn" : "default"}
                  />
                </div>
                {item.lead ? (
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    <StatusBadge label={sourceChannelLabel(item.lead.source)} tone={sourceChannelTone(item.lead.source)} />
                    <StatusBadge label={item.lead.lead_temp || "Warm"} tone={leadTempTone(item.lead.lead_temp)} />
                    <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                      {leadDisplayName(item.lead)}{item.lead.timeline ? ` · ${item.lead.timeline}` : ""}
                    </span>
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Due {formatDate(item.dueAt)}</div>
              </div>
            ))}
            {hotNow.map((lead) => (
              <Link key={lead.id} href="/app/intake" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="crm-card-muted crm-stack-8" style={{ padding: 14, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{firstNonEmpty(lead.full_name, lead.ig_username) || "Hot inquiry"}</div>
                      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Hot inbound — enough detail to reach out now.</div>
                    </div>
                    <StatusBadge label="Hot" tone="danger" />
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    {lead.intent ? <StatusBadge label={lead.intent} tone="default" /> : null}
                    {lead.timeline ? <StatusBadge label={lead.timeline} tone="warn" /> : null}
                    {lead.location_area ? <StatusBadge label={lead.location_area} tone="info" /> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </article>

        {/* RIGHT — Pipeline Health */}
        <article className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <div>
              <h2 className="crm-section-title">Pipeline</h2>
              <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2, marginBottom: 0 }}>From your Pipeline</p>
            </div>
            <Link href="/app/deals" className="crm-btn crm-btn-secondary">Open board</Link>
          </div>
          <div className="crm-pipeline-health-grid">
            {pipelineColumns.map((col) => (
              <div key={col.key} className="crm-pipeline-health-col">
                <div className="crm-pipeline-health-col__header">
                  <span className="crm-pipeline-health-col__label">{col.label}</span>
                  <span className="crm-pipeline-health-col__count">{col.deals.length}</span>
                </div>
                <div className="crm-stack-6">
                  {col.deals.length === 0 ? (
                    <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>None</div>
                  ) : col.deals.slice(0, 3).map((deal) => (
                    <div key={deal.id} className="crm-pipeline-health-deal">
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>
                        {firstNonEmpty(deal.propertyAddress, leadDisplayName(deal.lead)) || "Deal"}
                      </div>
                      {deal.lead?.timeline ? (
                        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{deal.lead.timeline}</div>
                      ) : null}
                    </div>
                  ))}
                  {col.deals.length > 3 ? (
                    <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>+{col.deals.length - 3} more</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>

      </section>

      {/* Active Transactions — under contract with checklist progress */}
      {underContractDeals.length > 0 ? (
        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <div>
              <h2 className="crm-section-title">Active Transactions</h2>
              <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2, marginBottom: 0 }}>From your Transaction Coordinator</p>
            </div>
            <Link href="/app/inbox" className="crm-btn crm-btn-secondary">Open TC</Link>
          </div>
          <div className="crm-stack-8">
            {underContractDeals.map((deal) => {
              const checklist = checklistByDeal.get(deal.id);
              const total = checklist?.total ?? 0;
              const completed = checklist?.completed ?? 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <div key={deal.id} className="crm-card-muted crm-stack-8" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "Deal"}</div>
                      {deal.lead ? (
                        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                          {leadDisplayName(deal.lead)}{deal.expectedCloseDate ? ` · Close ${formatDate(deal.expectedCloseDate)}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge label={dealStageLabel(deal.stage)} tone={dealStageTone(deal.stage)} />
                  </div>
                  {total > 0 ? (
                    <div className="crm-stack-4">
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-muted)" }}>
                        <span>Checklist</span>
                        <span style={{ fontWeight: 600, color: pct === 100 ? "var(--ok)" : "var(--ink)" }}>{completed}/{total} done</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          borderRadius: 3,
                          width: `${pct}%`,
                          background: pct === 100 ? "var(--ok)" : "var(--accent)",
                          transition: "width 400ms ease",
                        }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                      No checklist yet — open the deal to load the transaction template.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Stale deals */}
      {staleDeals.length > 0 ? (
        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Needs a Nudge</h2>
            <div className="crm-inline-actions" style={{ gap: 8 }}>
              <span className="crm-chip crm-chip-warn">{staleDeals.length} stale</span>
            </div>
          </div>
          <div className="crm-stack-8">
            {staleDeals.slice(0, 4).map((deal) => (
              <Link key={deal.id} href="/app/deals" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div className="crm-card-muted" style={{ padding: 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "Deal"}</span>
                    <StatusBadge label={dealStageLabel(deal.stage)} tone="default" />
                  </div>
                  <div style={{ marginTop: 4, color: "var(--ink-muted)", fontSize: 13 }}>
                    No movement in {formatTimeAgo(deal.updatedAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <WelcomeChecklist />
    </main>
  );
}
