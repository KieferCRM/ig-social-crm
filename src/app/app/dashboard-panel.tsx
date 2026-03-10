"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import KpiCard from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";

type LeadPreview = {
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
  last_message_preview: string | null;
  time_last_updated: string | null;
};

type SignalTimelineEvent = {
  id: string;
  lead_id: string | null;
  event_type: string;
  source: string;
  channel: string;
  occurred_at: string;
  message_text: string | null;
  intent_label: string | null;
  location_interest: string | null;
  timeline_hint: string | null;
  price_min: number | null;
  price_max: number | null;
  confidence: number | null;
};

type RecommendationPreview = {
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

type Reminder = {
  id: string;
  lead_id: string | null;
  due_at: string;
  status: "pending" | "done";
  note: string | null;
};

type DashboardPanelProps = {
  total: number;
  hot: number;
  newCount: number;
  closed: number;
  conversion: number;
  allLeads: LeadPreview[];
  timelineEvents: SignalTimelineEvent[];
  recommendations: RecommendationPreview[];
};

type StageValue = "New" | "Contacted" | "Qualified" | "Closed";

type PatchLeadResponse = {
  lead?: Partial<LeadPreview>;
  error?: string;
};

type PatchRecommendationResponse = {
  recommendation?: RecommendationPreview;
  error?: string;
};

function normalize(value: string | null | undefined, fallback: string): string {
  return (value || fallback).trim().toLowerCase();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function isSyntheticHandle(handle: string | null): boolean {
  if (!handle) return false;
  const value = handle.trim().toLowerCase();
  if (!value) return false;
  if (/^(import|intake|manual|event)_lead_[0-9a-f]{8}$/.test(value)) return true;
  if (/^(import|intake|manual)_[a-z0-9_]+_[0-9a-f]{8}$/.test(value)) return true;
  return false;
}

function leadDisplayName(lead: LeadPreview): string {
  const full = firstNonEmpty(lead.full_name);
  if (full) return full;

  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;

  const email = firstNonEmpty(lead.canonical_email);
  if (email) return email;

  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) return phone;

  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) {
    return `@${lead.ig_username}`;
  }

  return "Unnamed lead";
}

function leadIdentityLine(lead: LeadPreview): string {
  const parts: string[] = [];

  const email = firstNonEmpty(lead.canonical_email);
  if (email) parts.push(email);

  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) parts.push(phone);

  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) {
    parts.push(`@${lead.ig_username}`);
  }

  if (parts.length > 0) return parts.join(" • ");
  return "No contact details yet.";
}

function prettyLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function daysSince(dateIso: string | null): number {
  if (!dateIso) return 999;
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return 999;
  return (Date.now() - ts) / (24 * 3600_000);
}

const STAGE_OPTIONS: StageValue[] = ["New", "Contacted", "Qualified", "Closed"];

export default function DashboardPanel({
  total,
  hot,
  newCount,
  closed,
  conversion,
  allLeads,
  timelineEvents,
  recommendations: recommendationItems,
}: DashboardPanelProps) {
  const [leads, setLeads] = useState<LeadPreview[]>(allLeads);
  const [recommendations, setRecommendations] = useState<RecommendationPreview[]>(recommendationItems);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [savingByLead, setSavingByLead] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [savingByRecommendation, setSavingByRecommendation] = useState<Record<string, "saving" | "saved" | "error">>({});

  useEffect(() => {
    setLeads(allLeads);
  }, [allLeads]);

  useEffect(() => {
    setRecommendations(recommendationItems);
  }, [recommendationItems]);

  useEffect(() => {
    async function loadReminders() {
      try {
        const response = await fetch("/api/reminders");
        const data = (await response.json()) as { reminders?: Reminder[] };
        if (!response.ok) return;
        setReminders((data.reminders || []).filter((item) => item.status === "pending"));
      } catch {
        // Keep dashboard usable even if reminders fail.
      }
    }

    void loadReminders();
  }, []);

  const followUpsDueToday = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endTs = endOfToday.getTime();
    return reminders.filter((item) => new Date(item.due_at).getTime() <= endTs).length;
  }, [reminders]);

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return reminders.filter((item) => new Date(item.due_at).getTime() < now).length;
  }, [reminders]);

  const newLeadQueue = useMemo(() => {
    return leads
      .filter((lead) => normalize(lead.stage, "new") === "new")
      .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || ""))
      .slice(0, 6);
  }, [leads]);

  const staleHotQueue = useMemo(() => {
    return leads
      .filter((lead) => normalize(lead.lead_temp, "warm") === "hot" && daysSince(lead.time_last_updated) >= 3)
      .sort((a, b) => (a.time_last_updated || "").localeCompare(b.time_last_updated || ""))
      .slice(0, 4);
  }, [leads]);

  async function updateStage(leadId: string, stage: StageValue) {
    const snapshot = leads.find((lead) => lead.id === leadId);
    if (!snapshot) return;

    const updatedAt = new Date().toISOString();
    setLeads((previous) =>
      previous.map((lead) => (lead.id === leadId ? { ...lead, stage, time_last_updated: updatedAt } : lead))
    );
    setSavingByLead((previous) => ({ ...previous, [leadId]: "saving" }));

    try {
      const response = await fetch("/api/leads/simple", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, stage }),
      });
      const data = (await response.json()) as PatchLeadResponse;
      if (!response.ok || !data.lead) throw new Error(data.error || "Could not save stage.");

      setLeads((previous) =>
        previous.map((lead) => (lead.id === leadId ? { ...lead, ...data.lead } : lead))
      );
      setSavingByLead((previous) => ({ ...previous, [leadId]: "saved" }));
    } catch {
      setLeads((previous) =>
        previous.map((lead) => (lead.id === leadId ? snapshot : lead))
      );
      setSavingByLead((previous) => ({ ...previous, [leadId]: "error" }));
    }
  }

  async function updateRecommendationStatus(
    recommendationId: string,
    status: RecommendationPreview["status"]
  ) {
    const snapshot = recommendations;
    setRecommendations((previous) => previous.filter((item) => item.id !== recommendationId));
    setSavingByRecommendation((previous) => ({ ...previous, [recommendationId]: "saving" }));

    try {
      const response = await fetch(`/api/recommendations/${encodeURIComponent(recommendationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as PatchRecommendationResponse;
      if (!response.ok || !data.recommendation) {
        throw new Error(data.error || "Could not update recommendation.");
      }
      setSavingByRecommendation((previous) => ({ ...previous, [recommendationId]: "saved" }));
    } catch {
      setRecommendations(snapshot);
      setSavingByRecommendation((previous) => ({ ...previous, [recommendationId]: "error" }));
    }
  }

  const recentLeads = leads
    .slice()
    .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || ""))
    .slice(0, 8);

  const focusCount = newLeadQueue.length + staleHotQueue.length + recommendations.length;

  return (
    <div className="crm-dashboard-main" style={{ display: "grid", gap: 12 }}>
      <div className="crm-kpi-grid">
        <KpiCard label="Total Leads" value={total} />
        <KpiCard label="New Leads" value={newCount} tone={newCount > 0 ? "warn" : "default"} />
        <KpiCard label="Hot Leads" value={hot} tone={hot > 0 ? "warn" : "default"} />
        <KpiCard label="Follow-ups Due" value={followUpsDueToday} tone={followUpsDueToday > 0 ? "danger" : "ok"} helper={overdueCount > 0 ? `${overdueCount} overdue` : "No overdue"} />
        <KpiCard label="Close Rate" value={`${conversion}%`} tone={conversion > 0 ? "ok" : "default"} />
      </div>

      <section className="crm-card crm-dashboard-primary-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong>Focus Overview</strong>
          <StatusBadge label={focusCount > 0 ? "Active Queue" : "Caught Up"} tone={focusCount > 0 ? "warn" : "ok"} />
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label={`${newLeadQueue.length} new response needed`} tone={newLeadQueue.length > 0 ? "warn" : "default"} />
          <StatusBadge label={`${staleHotQueue.length} stale hot`} tone={staleHotQueue.length > 0 ? "danger" : "default"} />
          <StatusBadge label={`${recommendations.length} recommendations`} tone={recommendations.length > 0 ? "warn" : "default"} />
          <StatusBadge label={`${closed} closed`} tone="ok" />
          <StatusBadge label={`${timelineEvents.length} activity signals`} tone="info" />
        </div>
      </section>

      <div className="crm-dashboard-main-grid">
        <section className="crm-card crm-dashboard-primary-card" style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>Focus Queue</strong>
            <StatusBadge label={focusCount > 0 ? "Needs Attention" : "In Good Shape"} tone={focusCount > 0 ? "warn" : "ok"} />
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {newLeadQueue.length === 0 && staleHotQueue.length === 0 && recommendations.length === 0 ? (
              <EmptyState
                title="No urgent lead actions right now"
                body="You are caught up. Review your latest intake submissions or queue fresh follow-ups."
                action={<Link href="/app/intake" className="crm-btn crm-btn-secondary">Review Lead Intake</Link>}
              />
            ) : (
              <>
                {newLeadQueue.slice(0, 3).map((lead) => (
                  <div key={`new-${lead.id}`} className="crm-card-muted crm-focus-row" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{leadDisplayName(lead)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)" }}>{leadIdentityLine(lead)}</div>
                      </div>
                      <StatusBadge label="New lead" tone="warn" />
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/app/leads/${encodeURIComponent(lead.id)}`} className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                        Open
                      </Link>
                      <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                        Pipeline
                      </Link>
                    </div>
                  </div>
                ))}
                {staleHotQueue.slice(0, 2).map((lead) => (
                  <div key={`hot-${lead.id}`} className="crm-card-muted crm-focus-row" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{leadDisplayName(lead)}</div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)" }}>{leadIdentityLine(lead)}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: "var(--danger)" }}>Hot lead stale for {Math.round(daysSince(lead.time_last_updated))}d</div>
                      </div>
                      <Link href={`/app/leads/${encodeURIComponent(lead.id)}`} className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
                {recommendations.slice(0, 3).map((item) => {
                  const saveState = savingByRecommendation[item.id];
                  return (
                    <div key={item.id} className="crm-card-muted crm-focus-row" style={{ padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</div>
                        <StatusBadge
                          label={prettyLabel(item.priority)}
                          tone={item.priority === "urgent" ? "danger" : item.priority === "high" ? "warn" : "default"}
                        />
                      </div>
                      <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button className="crm-btn crm-btn-secondary" style={{ padding: "6px 9px", fontSize: 12 }} onClick={() => void updateRecommendationStatus(item.id, "done")}>Done</button>
                        <button className="crm-btn crm-btn-secondary" style={{ padding: "6px 9px", fontSize: 12 }} onClick={() => void updateRecommendationStatus(item.id, "dismissed")}>Dismiss</button>
                        <span style={{ fontSize: 12, color: saveState === "error" ? "var(--danger)" : saveState === "saved" ? "var(--ok)" : "var(--ink-muted)" }}>
                          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Error" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>

        <section className="crm-card crm-dashboard-secondary-card" style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>Pipeline Snapshot</strong>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{recentLeads.length} recent leads</span>
          </div>
          {recentLeads.length === 0 ? (
            <div style={{ marginTop: 10 }}>
              <EmptyState
                title="No leads yet"
                body="Start with your intake questionnaire or run a CSV import."
                action={<Link href="/app/intake" className="crm-btn crm-btn-primary">Set Up Lead Intake</Link>}
              />
            </div>
          ) : (
            <div className="crm-card-muted" style={{ marginTop: 10, padding: 8, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead>
                  <tr>
                    {["Lead", "Stage", "Temperature", "Updated", "Action"].map((label) => (
                      <th key={label} style={{ textAlign: "left", fontSize: 12, color: "var(--ink-faint)", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => {
                    const saveState = savingByLead[lead.id];
                    return (
                      <tr key={lead.id}>
                        <td style={{ padding: "10px 10px", borderBottom: "1px solid var(--line)" }}>
                          <div style={{ fontWeight: 700 }}>{leadDisplayName(lead)}</div>
                          <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)" }}>{leadIdentityLine(lead)}</div>
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: "1px solid var(--line)" }}>
                          <select
                            value={lead.stage || "New"}
                            onChange={(event) => void updateStage(lead.id, event.target.value as StageValue)}
                            style={{ minWidth: 120 }}
                          >
                            {STAGE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: "1px solid var(--line)" }}>
                          <StatusBadge label={lead.lead_temp || "Warm"} tone={normalize(lead.lead_temp, "warm") === "hot" ? "danger" : normalize(lead.lead_temp, "warm") === "cold" ? "info" : "warn"} />
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-muted)" }}>
                          {lead.time_last_updated ? new Date(lead.time_last_updated).toLocaleString() : "-"}
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Link href={`/app/leads/${encodeURIComponent(lead.id)}`} className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                              View
                            </Link>
                            <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                              {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Error" : ""}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
