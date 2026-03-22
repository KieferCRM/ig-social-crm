import Link from "next/link";
import { redirect } from "next/navigation";
import FormAlertsSection from "@/components/today/FormAlertsSection";
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

  const recommendationOwnerFilter = `owner_user_id.eq.${user.id},agent_id.eq.${user.id}`;

  const [{ data: leadData }, { data: dealData }, { data: recommendationData }, { data: agentRow }, { data: recentLeadData }, { data: formAlertData }] =
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
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("agents").select("settings, timezone").eq("id", user.id).maybeSingle(),
      supabase
        .from("leads")
        .select("id,full_name,canonical_phone,source,time_last_updated")
        .eq("agent_id", user.id)
        .gte("time_last_updated", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("time_last_updated", { ascending: false })
        .limit(5),
      supabase
        .from("receptionist_alerts")
        .select("id,alert_type,severity,title,message,created_at,metadata")
        .eq("agent_id", user.id)
        .eq("alert_type", "form_submission")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const leads = ((leadData || []) as LeadRow[]).filter((lead) => lead.id);
  const deals = ((dealData || []) as DealRow[])
    .map(mapDealRow)
    .filter((deal): deal is TodayDeal => Boolean(deal));
  const recommendations = (recommendationData || []) as RecommendationRow[];
  const workspaceSettings = readWorkspaceSettingsFromAgentSettings(agentRow?.settings || null);
  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const recentDocuments = workspaceSettings.documents.slice(0, 4);
  const isOffMarketAccount = onboardingState.account_type === "off_market_agent";

  const activeDeals = deals.filter((deal) => deal.stage !== "closed" && deal.stage !== "lost" && deal.stage !== "dead");
  const hotLeads = leads.filter((lead) => String(lead.lead_temp || "").toLowerCase() === "hot");
  const staleDeals = activeDeals.filter((deal) => isStale(deal.updatedAt, 7));
  const contactToday = recommendations.filter((item) => item.priority === "urgent" || item.priority === "high");
  const trueEmptyWorkspace = leads.length === 0 && deals.length === 0 && recommendations.length === 0;

  const agentTimezone = (agentRow?.timezone as string | null) ?? "America/New_York";
  // YYYY-MM-DD in the agent's local timezone (en-CA locale produces this format)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: agentTimezone });
  const followupsDue = activeDeals
    .filter((deal) => deal.nextFollowupDate && deal.nextFollowupDate <= todayStr)
    .sort((a, b) => (a.nextFollowupDate ?? "").localeCompare(b.nextFollowupDate ?? ""));
  const recentLeads = (recentLeadData || []) as Array<{
    id: string;
    full_name: string | null;
    canonical_phone: string | null;
    source: string | null;
    time_last_updated: string | null;
  }>;
  const formAlerts = (formAlertData || []) as Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    created_at: string;
  }>;

  const emptyStateBody = isOffMarketAccount
    ? "We did not find any deals, contacts, or follow-up items yet. Start with deals, documents, or a contact so the off-market workspace has something real to organize."
    : "We did not find any deals, contacts, or follow-up items yet. Start by opening intake or sharing a buyer or seller form so the workspace has something real to work with.";

  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));

  if (isOffMarketAccount) {
    return (
      <main className="crm-page crm-page-wide crm-stack-12">
        <FormAlertsSection initialAlerts={formAlerts} />

        {/* KPIs */}
        <section className="crm-kpi-grid crm-dashboard-kpi-grid">
          <KpiCard label="Active Deals" value={activeDeals.length} tone="ok" href="/app/pipeline" compact />
          <KpiCard
            label="Follow-ups Due"
            value={followupsDue.length}
            tone={followupsDue.length > 0 ? "danger" : "default"}
            href="/app/pipeline"
            compact
          />
          <KpiCard
            label="Stale Deals"
            value={staleDeals.length}
            tone={staleDeals.length > 0 ? "warn" : "default"}
            href="/app/pipeline"
            compact
          />
          <KpiCard
            label="New Leads"
            value={recentLeads.length}
            tone={recentLeads.length > 0 ? "ok" : "default"}
            href="/app/contacts"
            compact
          />
        </section>

        {trueEmptyWorkspace ? (
          <section className="crm-card crm-section-card">
            <EmptyState
              eyebrow="Off-Market workspace"
              title="Your deal command center is ready."
              body={emptyStateBody}
              action={
                <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Link href="/app/pipeline" className="crm-btn crm-btn-primary">Open pipeline</Link>
                  <Link href="/app/forms" className="crm-btn crm-btn-secondary">Share forms</Link>
                  <Link href="/app/contacts?add=true" className="crm-btn crm-btn-secondary">Add contact</Link>
                </div>
              }
            />
          </section>
        ) : null}

        {/* Main grid */}
        <section className="crm-today-grid">

          {/* LEFT — Follow-ups due */}
          <article className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Follow-ups Due</h2>
              </div>
              <Link href="/app/pipeline" className="crm-btn crm-btn-secondary">Open pipeline</Link>
            </div>

            <div className="crm-stack-8">
              {followupsDue.length === 0 ? (
                <div className="crm-card-muted" style={{ padding: 14, color: "var(--ink-muted)" }}>
                  No follow-ups due right now. Set a follow-up date on a deal in the pipeline to surface it here.
                </div>
              ) : null}
              {followupsDue.map((deal) => (
                <div key={deal.id} className="crm-card-muted crm-stack-6" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "—"}</div>
                      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{leadDisplayName(deal.lead)}</div>
                    </div>
                    <StatusBadge label={dealStageLabel(deal.stage)} tone={dealStageTone(deal.stage)} />
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    {deal.nextFollowupDate && deal.nextFollowupDate < todayStr ? (
                      <StatusBadge label="Overdue" tone="danger" />
                    ) : (
                      <StatusBadge label="Due today" tone="warn" />
                    )}
                    {deal.lead?.canonical_phone ? (
                      <a
                        href={`tel:${deal.lead.canonical_phone}`}
                        style={{ fontSize: 13, color: "var(--brand)", textDecoration: "none" }}
                      >
                        {deal.lead.canonical_phone}
                      </a>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    Follow-up set for {formatDate(deal.nextFollowupDate)}
                  </div>
                </div>
              ))}

              {/* Active deals without a follow-up set — always show if any exist */}
              {activeDeals.filter((d) => !d.nextFollowupDate).length > 0 ? (
                <div className="crm-card-muted" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                    {activeDeals.filter((d) => !d.nextFollowupDate).length} deals have no follow-up date set
                  </div>
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    Open the pipeline and set a follow-up date so these surface here automatically.
                  </div>
                </div>
              ) : null}
            </div>
          </article>

          {/* RIGHT — stacked cards */}
          <div className="crm-stack-12">

            {/* Stale deals */}
            <article className="crm-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <div>
                  <h2 className="crm-section-title">Stale Deals</h2>
                </div>
                <Link href="/app/pipeline" className="crm-btn crm-btn-secondary">Open pipeline</Link>
              </div>
              <div className="crm-stack-8">
                {staleDeals.length === 0 ? (
                  <div className="crm-card-muted" style={{ padding: 14, color: "var(--ink-muted)" }}>
                    All active deals have recent activity.
                  </div>
                ) : null}
                {staleDeals.slice(0, 4).map((deal) => (
                  <div key={deal.id} className="crm-card-muted crm-stack-4" style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{deal.propertyAddress || leadDisplayName(deal.lead) || "—"}</div>
                      <StatusBadge label={dealStageLabel(deal.stage)} tone={dealStageTone(deal.stage)} />
                    </div>
                    <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                      No movement since {formatTimeAgo(deal.updatedAt)} — needs a touch or stage update.
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* Recent new leads */}
            <article className="crm-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <div>
                  <h2 className="crm-section-title">New Leads</h2>
                </div>
                <Link href="/app/contacts" className="crm-btn crm-btn-secondary">Contacts</Link>
              </div>
              <div className="crm-stack-8">
                {recentLeads.length === 0 ? (
                  <div className="crm-card-muted" style={{ padding: 14, color: "var(--ink-muted)" }}>
                    No new leads this week. Share your forms or add a contact manually to get started.
                  </div>
                ) : null}
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="crm-card-muted crm-stack-4" style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{lead.full_name || "Anonymous"}</div>
                      {lead.source ? (
                        <StatusBadge label={sourceChannelLabel(lead.source)} tone={sourceChannelTone(lead.source)} />
                      ) : null}
                    </div>
                    <div className="crm-inline-actions" style={{ gap: 8 }}>
                      {lead.canonical_phone ? (
                        <a
                          href={`tel:${lead.canonical_phone}`}
                          style={{ fontSize: 13, color: "var(--brand)", textDecoration: "none" }}
                        >
                          {lead.canonical_phone}
                        </a>
                      ) : null}
                      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                        {formatTimeAgo(lead.time_last_updated)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

          </div>
        </section>
      </main>
    );
  }

  const socialReminders = recommendations.filter((item) => {
    const source = typeof item.metadata?.source_channel === "string" ? item.metadata.source_channel : "";
    const normalized = source.toLowerCase();
    return normalized === "instagram" || normalized === "facebook" || normalized === "tiktok";
  });

  const attentionRows = recommendations.slice(0, 5).map((item) => {
    const lead = item.lead_id ? leadMap.get(item.lead_id) || null : null;
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      dueAt: item.due_at,
      priority: item.priority,
      lead,
    };
  });

  const hotNow = hotLeads
    .filter((lead) => !attentionRows.some((item) => item.lead?.id === lead.id))
    .slice(0, 3);

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <FormAlertsSection initialAlerts={formAlerts} />

      <section className="crm-kpi-grid crm-dashboard-kpi-grid">
        <KpiCard label="Active Deals" value={activeDeals.length} tone="ok" href="/app/deals" compact />
        <KpiCard
          label="Needs Contact Today"
          value={contactToday.length}
          tone={contactToday.length > 0 ? "warn" : "default"}
          href="/app/priorities"
          compact
        />
        <KpiCard
          label="Hot Inbound"
          value={hotLeads.length}
          tone={hotLeads.length > 0 ? "danger" : "default"}
          href="/app/intake"
          compact
        />
        <KpiCard
          label="Stale Deals"
          value={staleDeals.length}
          tone={staleDeals.length > 0 ? "warn" : "default"}
          href="/app/priorities"
          compact
        />
      </section>

      {trueEmptyWorkspace ? (
        <section className="crm-card crm-section-card">
          <EmptyState
            eyebrow="First workspace view"
            title="Your workspace is ready."
            body={emptyStateBody}
            action={
              <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link href="/app/intake" className="crm-btn crm-btn-primary">
                  Open intake
                </Link>
                <Link href="/buyer" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
                  Buyer form
                </Link>
                <Link href="/seller" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
                  Seller form
                </Link>
              </div>
            }
          />
        </section>
      ) : null}

      <section className="crm-today-grid">
        <article className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <div>
              <h2 className="crm-section-title">Needs Attention Now</h2>
            </div>
            <Link href="/app/priorities" className="crm-btn crm-btn-secondary">
              Open priorities
            </Link>
          </div>

          <div className="crm-stack-8">
            {attentionRows.length === 0 && hotNow.length === 0 ? (
              <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700 }}>You&apos;re caught up</div>
                <div style={{ color: "var(--ink-muted)" }}>
                  New intake and follow-up recommendations will show here as the workspace updates.
                </div>
              </div>
            ) : null}

            {attentionRows.map((item) => (
              <div key={item.id} className="crm-card-muted crm-ai-panel crm-stack-8" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div className="crm-stack-4">
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    {item.description ? (
                      <div style={{ color: "var(--ink-muted)" }}>{item.description}</div>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={item.priority === "urgent" ? "Contact now" : "Today"}
                    tone={item.priority === "urgent" ? "danger" : "warn"}
                  />
                </div>
                {item.lead ? (
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    <StatusBadge label={sourceChannelLabel(item.lead.source)} tone={sourceChannelTone(item.lead.source)} />
                    <StatusBadge label={item.lead.lead_temp || "Warm"} tone={leadTempTone(item.lead.lead_temp)} />
                    <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                      {leadDisplayName(item.lead)}{item.lead.timeline ? ` • ${item.lead.timeline}` : ""}
                    </span>
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  Due {formatDate(item.dueAt)}
                </div>
              </div>
            ))}

            {hotNow.map((lead) => (
              <div key={lead.id} className="crm-card-muted crm-stack-8" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{firstNonEmpty(lead.full_name, lead.ig_username) || "Hot inquiry"}</div>
                    <div style={{ color: "var(--ink-muted)" }}>
                      Hot inbound from {sourceChannelLabel(lead.source)}. Enough detail to reach out right away.
                    </div>
                  </div>
                  <StatusBadge label="Hot" tone="danger" />
                </div>
                <div className="crm-inline-actions" style={{ gap: 8 }}>
                  <StatusBadge label={lead.intent || "Inquiry"} tone="default" />
                  {lead.timeline ? <StatusBadge label={lead.timeline} tone="warn" /> : null}
                  {lead.location_area ? <StatusBadge label={lead.location_area} tone="info" /> : null}
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="crm-stack-12">
          <article className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Active Deals Snapshot</h2>
              </div>
            </div>
            <div className="crm-stack-8">
              {activeDeals.slice(0, 5).map((deal) => (
                <div key={deal.id} className="crm-card-muted crm-stack-6" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {deal.propertyAddress || leadDisplayName(deal.lead)}
                      </div>
                      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                        {leadDisplayName(deal.lead)}{deal.lead?.timeline ? ` • ${deal.lead.timeline}` : ""}
                      </div>
                    </div>
                    <StatusBadge label={dealStageLabel(deal.stage)} tone={dealStageTone(deal.stage)} />
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    <StatusBadge label={dealTypeLabel(deal.dealType)} tone="default" />
                    {deal.lead?.source ? (
                      <StatusBadge label={sourceChannelLabel(deal.lead.source)} tone={sourceChannelTone(deal.lead.source)} />
                    ) : null}
                    {deal.lead?.lead_temp ? (
                      <StatusBadge label={deal.lead.lead_temp} tone={leadTempTone(deal.lead.lead_temp)} />
                    ) : null}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--ink-faint)" }}>
                    <span>Last touch {formatTimeAgo(deal.updatedAt)}</span>
                    <span>{deal.expectedCloseDate ? `Target ${formatDate(deal.expectedCloseDate)}` : "No close date"}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Hot / Stale / Due</h2>
              </div>
            </div>
            <div className="crm-stack-8">
              <div className="crm-inline-actions" style={{ gap: 8 }}>
                <span className="crm-chip crm-chip-danger">Hot inbound: {hotLeads.length}</span>
                <span className="crm-chip crm-chip-warn">Due today: {contactToday.length}</span>
                <span className="crm-chip">Stale deals: {staleDeals.length}</span>
              </div>
              {staleDeals.slice(0, 3).map((deal) => (
                <div key={deal.id} className="crm-card-muted" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{deal.propertyAddress || leadDisplayName(deal.lead)}</div>
                  <div style={{ marginTop: 4, color: "var(--ink-muted)", fontSize: 13 }}>
                    No movement since {formatTimeAgo(deal.updatedAt)}. It likely needs a quick update or follow-up.
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Documents and social</h2>
              </div>
            </div>

            <div className="crm-stack-8">
              <div className="crm-card-muted crm-stack-6" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700 }}>Recent document activity</div>
                {recentDocuments.length === 0 ? (
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    No documents uploaded yet.
                  </div>
                ) : (
                  recentDocuments.map((document) => (
                    <div key={document.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span>{document.file_name}</span>
                      <span style={{ color: "var(--ink-faint)" }}>{formatDate(document.uploaded_at)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="crm-card-muted crm-stack-6" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700 }}>Social reminders</div>
                {socialReminders.length === 0 ? (
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    No social follow-up items right now.
                  </div>
                ) : (
                  socialReminders.slice(0, 3).map((item) => (
                    <div key={item.id} className="crm-stack-4">
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                        {item.description || "Follow up through the source platform or move the deal forward."}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
