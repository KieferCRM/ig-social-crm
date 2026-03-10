"use client";

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

type GuidancePriority = "Urgent" | "High" | "Normal";
type ContactMethod = "SMS" | "Call" | "Instagram" | "Messenger" | "Email";

type GuidanceItem = {
  leadId: string;
  leadName: string;
  reason: string;
  priority: GuidancePriority;
  action: ContactMethod;
};

function priorityRank(priority: GuidancePriority): number {
  if (priority === "Urgent") return 3;
  if (priority === "High") return 2;
  return 1;
}

function priorityTone(priority: GuidancePriority): "danger" | "warn" | "info" {
  if (priority === "Urgent") return "danger";
  if (priority === "High") return "warn";
  return "info";
}

function contactMethodMeta(method: ContactMethod): { label: string; icon: "sms" | "phone" | "instagram" | "messenger" | "email" } {
  if (method === "SMS") return { label: "SMS", icon: "sms" };
  if (method === "Call") return { label: "Call", icon: "phone" };
  if (method === "Instagram") return { label: "Instagram", icon: "instagram" };
  if (method === "Messenger") return { label: "Messenger", icon: "messenger" };
  return { label: "Email", icon: "email" };
}

function ContactMethodIcon({
  kind,
}: {
  kind: "sms" | "phone" | "instagram" | "messenger" | "email";
}) {
  if (kind === "sms") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          d="M2.5 3.5h11v7h-7l-3 2v-2h-1a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "phone") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          d="M4 2.8h2l.7 2.7-1.3.9a9.1 9.1 0 0 0 4.2 4.2l.9-1.3 2.7.7v2a1 1 0 0 1-1 1A10.2 10.2 0 0 1 3 4a1 1 0 0 1 1-1.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "instagram") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="12" cy="4.2" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "messenger") {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          d="M8 2.2c-3.3 0-6 2.3-6 5.2 0 1.7.9 3.1 2.3 4.1V14l2.2-1.2c.5.1 1 .2 1.5.2 3.3 0 6-2.3 6-5.2S11.3 2.2 8 2.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m5.4 8.9 2.2-2.3 1.3 1.2 1.8-1.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="m2.5 4.2 5.5 4.2 5.5-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ContactMethodTag({ method }: { method: ContactMethod }) {
  const meta = contactMethodMeta(method);
  return (
    <span className="crm-contact-method-tag">
      <span className="crm-contact-method-icon" aria-hidden="true">
        <ContactMethodIcon kind={meta.icon} />
      </span>
      <span>{meta.label}</span>
    </span>
  );
}

function buildGuidance(leads: LeadPreview[], reminders: Reminder[]): GuidanceItem[] {
  const now = Date.now();
  const reminderByLead = new Map<string, { overdue: number; dueSoon: number }>();
  for (const reminder of reminders) {
    if (!reminder.lead_id) continue;
    const dueAt = new Date(reminder.due_at).getTime();
    const current = reminderByLead.get(reminder.lead_id) || { overdue: 0, dueSoon: 0 };
    if (dueAt < now) current.overdue += 1;
    if (dueAt >= now && dueAt < now + 24 * 3600_000) current.dueSoon += 1;
    reminderByLead.set(reminder.lead_id, current);
  }

  const guidance: GuidanceItem[] = [];
  for (const lead of leads) {
    if (normalize(lead.stage, "new") === "closed") continue;
    const staleDays = daysSince(lead.time_last_updated);
    const reminder = reminderByLead.get(lead.id) || { overdue: 0, dueSoon: 0 };
    const name = leadDisplayName(lead);

    if (reminder.overdue > 0) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `${reminder.overdue} follow-up reminder(s) are overdue.`,
        priority: "Urgent",
        action: "Call",
      });
      continue;
    }

    if (normalize(lead.stage, "new") === "new") {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason:
          staleDays <= 1
            ? "New lead submitted recently. Fast response improves conversion."
            : "New lead has not been contacted yet.",
        priority: staleDays > 1 ? "Urgent" : "High",
        action: staleDays > 1 ? "Call" : "SMS",
      });
      continue;
    }

    if (normalize(lead.lead_temp, "warm") === "hot" && staleDays >= 2) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `Hot lead has been inactive for ${Math.round(staleDays)} day(s).`,
        priority: "Urgent",
        action: "Call",
      });
      continue;
    }

    if (normalize(lead.lead_temp, "warm") === "warm" && staleDays >= 2) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `Warm lead has not been touched for ${Math.round(staleDays)} day(s).`,
        priority: "High",
        action: "SMS",
      });
      continue;
    }

    if (reminder.dueSoon > 0) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `${reminder.dueSoon} follow-up due within 24 hours.`,
        priority: "High",
        action: "SMS",
      });
      continue;
    }

    if (staleDays >= 4) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `No recent activity for ${Math.round(staleDays)} day(s).`,
        priority: "Normal",
        action: "Email",
      });
    }
  }

  return guidance
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 5);
}

export default function DashboardPanel({
  total,
  hot,
  newCount,
  closed,
  conversion,
  allLeads,
  recommendations: recommendationItems,
}: DashboardPanelProps) {
  const [leads, setLeads] = useState<LeadPreview[]>(allLeads);
  const [recommendations, setRecommendations] = useState<RecommendationPreview[]>(recommendationItems);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [savingByRecommendation, setSavingByRecommendation] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [activeLead, setActiveLead] = useState<LeadPreview | null>(null);

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

  const guidance = useMemo(() => buildGuidance(leads, reminders), [leads, reminders]);

  const focusCount = newLeadQueue.length + staleHotQueue.length + recommendations.length + overdueCount;

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
    <div className="crm-dashboard-main" style={{ display: "grid", gap: 12 }}>
      <div className="crm-kpi-grid">
        <KpiCard label="Total Leads" value={total} href="/app/list" ctaLabel="View all leads" />
        <KpiCard
          label="New Leads"
          value={newCount}
          tone={newCount > 0 ? "warn" : "default"}
          href="/app/list?stage=New"
          ctaLabel="View new leads"
        />
        <KpiCard
          label="Hot Leads"
          value={hot}
          tone={hot > 0 ? "warn" : "default"}
          href="/app/list?temp=Hot"
          ctaLabel="View hot leads"
        />
        <KpiCard
          label="Follow-ups Due"
          value={followUpsDueToday}
          tone={followUpsDueToday > 0 ? "danger" : "ok"}
          helper={overdueCount > 0 ? `${overdueCount} overdue` : "No overdue"}
          href="/app/list?follow_up=due"
          ctaLabel="View due follow-ups"
        />
        <KpiCard
          label="Close Rate"
          value={`${conversion}%`}
          tone={conversion > 0 ? "ok" : "default"}
          href="/app/list?stage=Closed"
          ctaLabel="View closed leads"
        />
      </div>

      <div className="crm-dashboard-main-columns">
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
                      <button
                        type="button"
                        onClick={() => openLeadPanel(lead.id, lead)}
                        className="crm-btn crm-btn-secondary"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                      >
                        Open
                      </button>
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
                      <button
                        type="button"
                        onClick={() => openLeadPanel(lead.id, lead)}
                        className="crm-btn crm-btn-secondary"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                      >
                        Open
                      </button>
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
            <strong>Merlyn AI Guidance</strong>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{guidance.length} actions</span>
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {guidance.length === 0 ? (
              <EmptyState
                title="No guidance items right now"
                body="You are caught up. Check new intake submissions or queue follow-ups for warm leads."
                action={<Link href="/app/intake" className="crm-btn crm-btn-secondary">Open Lead Intake</Link>}
              />
            ) : (
              guidance.map((item) => (
                <div key={`${item.leadId}-${item.action}`} className="crm-card-muted crm-focus-row" style={{ padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700 }}>{item.leadName}</div>
                    <StatusBadge label={item.priority} tone={priorityTone(item.priority)} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>{item.reason}</div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <ContactMethodTag method={item.action} />
                  <button
                    type="button"
                    onClick={() => openLeadPanel(item.leadId)}
                      className="crm-btn crm-btn-secondary"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                    >
                      Open Lead
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
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
