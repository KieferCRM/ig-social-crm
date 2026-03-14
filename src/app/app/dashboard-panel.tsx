"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import KpiCard from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import LeadDetailPanel from "@/components/leads/lead-detail-panel";

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
  intent?: string | null;
  timeline?: string | null;
  notes?: string | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
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

type DashboardPanelProps = {
  hot: number;
  newCount: number;
  activeDeals: number;
  underContract: number;
  closingThisMonth: number;
  rightRail: ReactNode;
  allLeads: LeadPreview[];
  recommendations: RecommendationPreview[];
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

function formatPhoneDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (localDigits.length !== 10) return value;
  return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
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
  if (phone) return formatPhoneDisplay(phone) || phone;

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
  if (phone) parts.push(formatPhoneDisplay(phone) || phone);

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

export default function DashboardPanel({
  hot,
  newCount,
  activeDeals,
  underContract,
  closingThisMonth,
  rightRail,
  allLeads,
  recommendations: recommendationItems,
}: DashboardPanelProps) {
  const [leads, setLeads] = useState<LeadPreview[]>(allLeads);
  const [recommendations, setRecommendations] = useState<RecommendationPreview[]>(recommendationItems);
  const [savingByRecommendation, setSavingByRecommendation] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [activeLead, setActiveLead] = useState<LeadPreview | null>(null);

  useEffect(() => {
    setLeads(allLeads);
  }, [allLeads]);

  useEffect(() => {
    setRecommendations(recommendationItems);
  }, [recommendationItems]);

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

  const focusCount = newLeadQueue.length + staleHotQueue.length + recommendations.length;
  const hasNewQueue = newLeadQueue.length > 0;
  const hasHotQueue = staleHotQueue.length > 0;

  function openLeadPanel(leadId: string, seed?: LeadPreview) {
    if (seed) {
      setActiveLead(seed);
      return;
    }
    const found = leads.find((lead) => lead.id === leadId);
    if (found) {
      setActiveLead(found);
      return;
    }
    setActiveLead({
      id: leadId,
      ig_username: null,
      full_name: null,
      first_name: null,
      last_name: null,
      canonical_email: null,
      canonical_phone: null,
      stage: null,
      lead_temp: null,
      source: null,
      intent: null,
      timeline: null,
      notes: null,
      last_message_preview: null,
      time_last_updated: null,
    });
  }

  return (
    <div className="crm-dashboard-main crm-stack-12">
      <div className="crm-kpi-grid crm-dashboard-kpi-grid">
        <KpiCard
          label="New Leads"
          value={newCount}
          tone={newCount > 0 ? "warn" : "default"}
          href="/app/list?stage=New"
          compact
        />
        <KpiCard
          label="Hot Leads"
          value={hot}
          tone={hot > 0 ? "danger" : "default"}
          href="/app/list?temp=Hot"
          compact
        />
        <KpiCard
          label="Active Deals"
          value={activeDeals}
          tone={activeDeals > 0 ? "ok" : "default"}
          helper={underContract > 0 ? `${underContract} under contract` : "No contracts yet"}
          href="/app/deals"
          compact
        />
        <KpiCard
          label="Closing This Month"
          value={closingThisMonth}
          tone={closingThisMonth > 0 ? "warn" : "default"}
          href="/app/deals"
          compact
        />
      </div>

      <div className="crm-dashboard-main-columns">
        <section className="crm-card crm-dashboard-primary-card crm-section-card">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Focus Queue</h2>
            <StatusBadge label={focusCount > 0 ? "Needs Attention" : "In Good Shape"} tone={focusCount > 0 ? "danger" : "ok"} />
          </div>
          <div className="crm-stack-8">
            {newLeadQueue.length === 0 && staleHotQueue.length === 0 && recommendations.length === 0 ? (
              <EmptyState
                title="No urgent lead actions right now"
                body="You are caught up. Review your latest intake submissions or queue fresh follow-ups."
                action={<Link href="/app/intake" className="crm-btn crm-btn-secondary">Review Lead Intake</Link>}
              />
            ) : (
              <>
                {newLeadQueue.slice(0, 4).map((lead) => (
                  <button
                    key={`new-${lead.id}`}
                    type="button"
                    onClick={() => openLeadPanel(lead.id, lead)}
                    className={`crm-card-muted crm-focus-row${focusCount > 0 ? " crm-focus-row-alert" : ""}${hasNewQueue && newLeadQueue[0]?.id === lead.id ? " crm-focus-row-primary" : ""}`}
                    style={{ padding: 8 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <span className="crm-focus-link">
                          {leadDisplayName(lead)}
                        </span>
                        <div className="crm-focus-meta">{leadIdentityLine(lead)}</div>
                      </div>
                      <StatusBadge label="New" tone="warn" />
                    </div>
                  </button>
                ))}

                {staleHotQueue.slice(0, 2).map((lead) => {
                  const staleDays = Math.round(daysSince(lead.time_last_updated));
                  return (
                    <button
                      key={`hot-${lead.id}`}
                      type="button"
                      onClick={() => openLeadPanel(lead.id, lead)}
                      className={`crm-card-muted crm-focus-row crm-focus-row-hot${focusCount > 0 ? " crm-focus-row-alert" : ""}${!hasNewQueue && hasHotQueue && staleHotQueue[0]?.id === lead.id ? " crm-focus-row-primary" : ""}`}
                      style={{ padding: 8 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0 }}>
                          <span className="crm-focus-link">
                            {leadDisplayName(lead)}
                          </span>
                          <div className="crm-focus-meta">{leadIdentityLine(lead)}</div>
                          <div className="crm-focus-alert">
                            No activity for {staleDays} day{staleDays === 1 ? "" : "s"}
                          </div>
                        </div>
                        <span className="crm-chip crm-chip-hot">Hot</span>
                      </div>
                    </button>
                  );
                })}

                {recommendations.slice(0, 3).map((item) => {
                  const saveState = savingByRecommendation[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`crm-card-muted crm-focus-row${focusCount > 0 ? " crm-focus-row-alert" : ""}${!hasNewQueue && !hasHotQueue && recommendations[0]?.id === item.id ? " crm-focus-row-primary" : ""}`}
                      style={{ padding: 8 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</div>
                          {item.description ? (
                            <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge
                          label={prettyLabel(item.priority)}
                          tone={item.priority === "urgent" ? "danger" : item.priority === "high" ? "warn" : "default"}
                        />
                      </div>
                      <div className="crm-card-actions" style={{ marginTop: 6 }}>
                        <button className="crm-btn crm-btn-secondary" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => void updateRecommendationStatus(item.id, "done")}>Done</button>
                        <button className="crm-btn crm-btn-secondary" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => void updateRecommendationStatus(item.id, "dismissed")}>Dismiss</button>
                        <span style={{ fontSize: 11, color: saveState === "error" ? "var(--danger)" : saveState === "saved" ? "var(--ok)" : "var(--ink-muted)" }}>
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

        <aside className="crm-dashboard-rail-panel">{rightRail}</aside>
      </div>

      <LeadDetailPanel
        leadId={activeLead?.id || null}
        initialLead={activeLead}
        open={Boolean(activeLead?.id)}
        onClose={() => setActiveLead(null)}
      />
    </div>
  );
}
