"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LeadDraft = {
  full_name: string;
  canonical_phone: string;
  canonical_email: string;
  stage: string;
  lead_temp: string;
  intent: string;
  timeline: string;
  budget_range: string;
  location_area: string;
  next_step: string;
  notes: string;
  deal_price: string;
  commission_percent: string;
  commission_amount: string;
  close_date: string;
};
import {
  calculateCommissionAmount,
  formatCurrency,
  formatPercentLabel,
  parsePositiveDecimal,
} from "@/lib/deal-metrics";
import ConvertToDealButton from "./convert-to-deal-button";

export type LeadWorkspaceLead = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  source: string | null;
  stage: string | null;
  lead_temp: string | null;
  deal_price: number | string | null;
  commission_percent: number | string | null;
  commission_amount: number | string | null;
  close_date: string | null;
  intent: string | null;
  timeline: string | null;
  budget_range: string | null;
  location_area: string | null;
  contact_preference: string | null;
  next_step: string | null;
  notes: string | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
  last_communication_at?: string | null;
  created_at?: string | null;
  urgency_level?: string | null;
  urgency_score?: number | null;
};

export type ReminderPreview = {
  id: string;
  due_at: string;
  status: string;
  note: string | null;
};

type LeadCommandWorkspaceProps = {
  lead: LeadWorkspaceLead;
  reminders: ReminderPreview[];
  conciergeEnabled: boolean;
};

const QUICK_STEP_OPTIONS = [
  { key: "call", label: "Call", value: "Call lead" },
  { key: "text", label: "Text", value: "Send text follow-up" },
  { key: "follow_up", label: "Schedule Follow-Up", value: "Schedule follow-up" },
  { key: "note", label: "Add Note", value: "Add note after contact" },
  { key: "stage", label: "Move Stage", value: "Move lead to the next stage" },
] as const;

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

function cleanHandle(handle: string | null): string | null {
  if (!handle || isSyntheticHandle(handle)) return null;
  return `@${handle.trim().replace(/^@+/, "")}`;
}

function prettyLabel(value: string | null | undefined): string {
  const text = (value || "").trim();
  if (!text) return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sourceDisplayLabel(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "manual") return "Direct Entry";
  if (normalized === "import") return "Imported";
  if (normalized === "intake" || normalized === "questionnaire") return "Intake Form";
  if (normalized === "fub" || normalized === "follow_up_boss" || normalized === "followupboss") {
    return "Follow Up Boss Import";
  }
  return prettyLabel(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return trimmed;

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function leadDisplayName(lead: LeadWorkspaceLead): string {
  const full = firstNonEmpty(lead.full_name);
  if (full) return full;

  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;

  const handle = cleanHandle(lead.ig_username);
  if (handle) return handle;

  const email = firstNonEmpty(lead.canonical_email);
  if (email) return email;

  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) return formatPhoneDisplay(phone) || phone;

  return "Unnamed lead";
}

function leadTempChipClass(leadTemp: string | null): string {
  const normalized = (leadTemp || "").trim().toLowerCase();
  if (normalized === "hot") return "crm-chip crm-chip-danger";
  if (normalized === "warm") return "crm-chip crm-chip-warn";
  return "crm-chip";
}

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-card-muted crm-lead-command-mini">
      <div className="crm-lead-command-mini-label">{label}</div>
      <div className="crm-lead-command-mini-value">{value}</div>
    </div>
  );
}

function draftFromLead(lead: LeadWorkspaceLead): LeadDraft {
  return {
    full_name: lead.full_name ?? "",
    canonical_phone: lead.canonical_phone ?? "",
    canonical_email: lead.canonical_email ?? "",
    stage: lead.stage ?? "New",
    lead_temp: lead.lead_temp ?? "Warm",
    intent: lead.intent ?? "",
    timeline: lead.timeline ?? "",
    budget_range: lead.budget_range ?? "",
    location_area: lead.location_area ?? "",
    next_step: lead.next_step ?? "",
    notes: lead.notes ?? "",
    deal_price: lead.deal_price != null ? String(lead.deal_price) : "",
    commission_percent: lead.commission_percent != null ? String(lead.commission_percent) : "",
    commission_amount: lead.commission_amount != null ? String(lead.commission_amount) : "",
    close_date: lead.close_date ?? "",
  };
}

export default function LeadCommandWorkspace({
  lead: initialLead,
  reminders,
  conciergeEnabled,
}: LeadCommandWorkspaceProps) {
  const [lead, setLead] = useState<LeadWorkspaceLead>(initialLead);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<LeadDraft>(() => draftFromLead(initialLead));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedQuickStep, setSelectedQuickStep] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    setSummaryLoading(true);
    fetch(`/api/leads/${lead.id}/summary`)
      .then((r) => r.json())
      .then((data: { summary?: string }) => {
        if (data.summary) setAiSummary(data.summary);
      })
      .catch(() => null)
      .finally(() => setSummaryLoading(false));
  }, [lead.id]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/leads/simple/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: draft.full_name || null,
          canonical_phone: draft.canonical_phone || null,
          canonical_email: draft.canonical_email || null,
          stage: draft.stage,
          lead_temp: draft.lead_temp,
          intent: draft.intent || null,
          timeline: draft.timeline || null,
          budget_range: draft.budget_range || null,
          location_area: draft.location_area || null,
          next_step: draft.next_step || null,
          notes: draft.notes || null,
          deal_price: draft.deal_price || null,
          commission_percent: draft.commission_percent || null,
          commission_amount: draft.commission_amount || null,
          close_date: draft.close_date || null,
        }),
      });
      const data = await res.json() as { lead?: LeadWorkspaceLead; error?: string };
      if (!res.ok || !data.lead) {
        setSaveError(data.error ?? "Could not save changes.");
        return;
      }
      setLead(data.lead);
      setDraft(draftFromLead(data.lead));
      setEditMode(false);
    } catch {
      setSaveError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(draftFromLead(lead));
    setEditMode(false);
    setSaveError(null);
  }
  const displayName = useMemo(() => leadDisplayName(lead), [lead]);
  const phoneValue = firstNonEmpty(lead.canonical_phone);
  const formattedPhone = formatPhoneDisplay(phoneValue);
  const emailValue = firstNonEmpty(lead.canonical_email);
  const handleValue = cleanHandle(lead.ig_username);
  const sourceLabel = sourceDisplayLabel(lead.source) || "Unspecified source";
  const stageLabel = prettyLabel(lead.stage) || "New";
  const tempLabel = prettyLabel(lead.lead_temp) || "Warm";
  const urgencyLabel = prettyLabel(lead.urgency_level);
  const urgencyScore =
    typeof lead.urgency_score === "number" && Number.isFinite(lead.urgency_score)
      ? Math.max(0, Math.min(100, Math.round(lead.urgency_score)))
      : null;
  const pendingReminders = reminders.filter((item) => item.status === "pending");
  const nextReminder = pendingReminders[0] || null;
  const createdAtShort = formatShortDate(lead.created_at);
  const updatedAtShort = formatShortDate(lead.time_last_updated);

  const recommendedAction = useMemo(() => {
    const stage = (lead.stage || "").trim().toLowerCase();
    const temp = (lead.lead_temp || "").trim().toLowerCase();
    if (stage === "new") return "Initial outreach now. First response speed is key.";
    if (temp === "hot") return "Contact today and secure a clear next step before this lead cools off.";
    if (pendingReminders.length > 0) return "Clear pending reminders so this lead does not slip.";
    if (!firstNonEmpty(lead.next_step)) return "Set a concrete next step after your next touchpoint.";
    return "Keep momentum moving with the next scheduled follow-up.";
  }, [lead.lead_temp, lead.next_step, lead.stage, pendingReminders.length]);

  const dealPrice = parsePositiveDecimal(lead.deal_price);
  const commissionPercent = parsePositiveDecimal(lead.commission_percent);
  const commissionAmount =
    parsePositiveDecimal(lead.commission_amount) ?? calculateCommissionAmount(dealPrice, commissionPercent);
  const hasDealDetails =
    dealPrice !== null || commissionPercent !== null || commissionAmount !== null || Boolean(firstNonEmpty(lead.close_date));
  const actionCenterRecommendation =
    stageLabel.toLowerCase() === "contacted"
      ? "Confirm motivation, timeline, and buying/selling plan."
      : recommendedAction;
  const lockboxInsight =
    stageLabel.toLowerCase() === "contacted"
      ? "Leads in \"Contacted\" stage convert best when a follow-up happens within 24 hours."
      : "Quick follow-up keeps serious inquiries moving while intent is still fresh.";
  const nextStepValue =
    QUICK_STEP_OPTIONS.find((option) => option.key === selectedQuickStep)?.value ||
    firstNonEmpty(lead.next_step) ||
    "No next step set yet";

  return (
    <main className="crm-page crm-page-wide crm-lead-command-page">
      {(aiSummary || summaryLoading) && (
        <section className="crm-card crm-section-card" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>✦</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>AI Briefing</div>
            {summaryLoading && !aiSummary
              ? <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Generating briefing…</div>
              : <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.55 }}>{aiSummary}</div>
            }
          </div>
        </section>
      )}
      <section className="crm-card crm-section-card crm-lead-command-hero">
        <div className="crm-lead-command-hero-main">
          <div className="crm-lead-command-kicker">Lead Command Workspace</div>
          {editMode ? (
            <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                  Full name
                  <input className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft.full_name} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                  Phone
                  <input className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft.canonical_phone} onChange={(e) => setDraft((d) => ({ ...d, canonical_phone: e.target.value }))} placeholder="+1 555 000 0000" />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                  Email
                  <input className="crm-input" type="email" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft.canonical_email} onChange={(e) => setDraft((d) => ({ ...d, canonical_email: e.target.value }))} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                    Stage
                    <select className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft.stage} onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))}>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Closed">Past Client</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                    Temp
                    <select className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft.lead_temp} onChange={(e) => setDraft((d) => ({ ...d, lead_temp: e.target.value }))}>
                      <option value="Cold">Cold</option>
                      <option value="Warm">Warm</option>
                      <option value="Hot">Hot</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="crm-lead-command-title">{displayName}</h1>
              <div className="crm-lead-command-contact-line">
                <span>{formattedPhone || "No phone saved yet"}</span>
                <span>{emailValue || "No email saved yet"}</span>
                {handleValue ? <span>{handleValue}</span> : null}
              </div>
              <div className="crm-lead-command-chip-row">
                <span className="crm-chip">{stageLabel}</span>
                <span className={leadTempChipClass(lead.lead_temp)}>{tempLabel}</span>
                <span className="crm-chip crm-chip-info">{sourceLabel}</span>
                {urgencyLabel ? (
                  <span className={urgencyLabel.toLowerCase() === "high" ? "crm-chip crm-chip-danger" : "crm-chip"}>
                    Urgency{urgencyScore !== null ? ` ${urgencyScore}` : ""}: {urgencyLabel}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="crm-lead-command-hero-actions">
          <div className="crm-lead-command-secondary-actions">
            {editMode ? (
              <>
                <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="crm-btn crm-btn-secondary" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button type="button" className="crm-btn crm-btn-primary" onClick={() => setEditMode(true)}>
                  Edit lead
                </button>
                <Link href="/app/pipeline" className="crm-btn crm-btn-secondary">
                  Open in Pipeline
                </Link>
                <ConvertToDealButton leadId={lead.id} defaultPropertyAddress={lead.location_area} />
                <Link href="/app/contacts" className="crm-btn crm-btn-secondary">
                  Back to Contacts
                </Link>
              </>
            )}
          </div>
          {saveError ? (
            <div style={{ marginTop: 8, fontSize: 13, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 10px" }}>
              {saveError}
            </div>
          ) : null}
        </div>
      </section>

      <div className="crm-lead-command-layout">
        <div className="crm-lead-command-main-column">
          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Contact and Lead Details</h2>
                <p className="crm-section-subtitle">
                  The core information you need to qualify the lead and move the conversation forward.
                </p>
              </div>
            </div>

            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["intent", "timeline", "location_area", "budget_range", "next_step"] as const).map((field) => {
                  const labels: Record<string, string> = { intent: "Intent", timeline: "Timeline", location_area: "Area", budget_range: "Budget", next_step: "Next step" };
                  return (
                    <label key={field} style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                      {labels[field]}
                      <input className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft[field]} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} />
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="crm-lead-command-fact-grid">
                <MetricField label="Phone" value={formattedPhone || "Not provided"} />
                <MetricField label="Email" value={emailValue || "Not provided"} />
                <MetricField label="Intent" value={firstNonEmpty(lead.intent) || "Not captured yet"} />
                <MetricField label="Timeline" value={firstNonEmpty(lead.timeline) || "Not captured yet"} />
                <MetricField label="Area" value={firstNonEmpty(lead.location_area) || "Not captured yet"} />
                <MetricField label="Budget" value={firstNonEmpty(lead.budget_range) || "Not captured yet"} />
              </div>
            )}
          </section>

          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Notes</h2>
                <p className="crm-section-subtitle">
                  Keep personal context here so the next touchpoint feels informed.
                </p>
              </div>
            </div>
            <div className="crm-lead-command-notes">
              {editMode ? (
                <textarea
                  className="crm-input"
                  style={{ width: "100%", minHeight: 100, fontSize: 13, resize: "vertical" }}
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Add context after your first conversation so future follow-ups stay personal."
                />
              ) : firstNonEmpty(lead.notes) ? (
                <div className="crm-lead-command-notes-copy">{lead.notes}</div>
              ) : (
                <div className="crm-lead-command-empty">
                  Add context after your first conversation so future follow-ups stay personal.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="crm-lead-command-side-column">
          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Lead Action Center</h2>
                <p className="crm-section-subtitle">
                  Keep the next move obvious so this lead keeps moving.
                </p>
              </div>
            </div>

            <div className="crm-lead-command-action-center">
              <div className="crm-card-muted crm-lead-command-action-block">
                <div className="crm-lead-command-mini-label">Next Recommended Action</div>
                <div className="crm-lead-command-action-copy">{actionCenterRecommendation}</div>
              </div>

              <div className="crm-card-muted crm-lead-command-action-block">
                <div className="crm-lead-command-mini-label">Primary Actions</div>
                <div className="crm-lead-command-action-row">
                  {QUICK_STEP_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`crm-btn ${selectedQuickStep === option.key ? "crm-btn-primary" : "crm-btn-secondary"}`}
                      aria-pressed={selectedQuickStep === option.key}
                      onClick={() =>
                        setSelectedQuickStep((current) => (current === option.key ? null : option.key))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {!conciergeEnabled ? (
                  <div className="crm-lead-command-action-helper">
                    Enable Concierge to call and text leads directly from LockboxHQ.
                  </div>
                ) : null}
                <div className="crm-lead-command-inline-note">
                  Next step: {nextStepValue}
                </div>
              </div>

              <div className="crm-card-muted crm-lead-command-action-block">
                <div className="crm-lead-command-mini-label">Next Reminder</div>
                <div className="crm-lead-command-action-copy">
                  {nextReminder
                    ? `${formatDateTime(nextReminder.due_at)}${nextReminder.note ? ` • ${nextReminder.note}` : ""}`
                    : "No reminder scheduled"}
                </div>
              </div>

              <div className="crm-card-muted crm-lead-command-action-block">
                <div className="crm-lead-command-mini-label">Recent Activity</div>
                <div className="crm-lead-command-activity-list">
                  <div>Lead created — {createdAtShort || "No timestamp"}</div>
                  <div>Profile updated — {updatedAtShort || "No timestamp"}</div>
                  <div>Last message — {firstNonEmpty(lead.last_message_preview) || "No message logged"}</div>
                </div>
              </div>

              <div className="crm-card-muted crm-lead-command-action-block">
                <div className="crm-lead-command-mini-label">LockboxHQ Insight</div>
                <div className="crm-lead-command-action-copy">{lockboxInsight}</div>
              </div>
            </div>
          </section>

          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Deal Details</h2>
                <p className="crm-section-subtitle">
                  Revenue context stays near the top once this lead becomes active business.
                </p>
              </div>
              {stageLabel ? (
                <span className={stageLabel.toLowerCase() === "closed" ? "crm-chip crm-chip-ok" : "crm-chip"}>
                  {stageLabel}
                </span>
              ) : null}
            </div>

            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(["deal_price", "commission_percent", "commission_amount"] as const).map((field) => {
                  const labels: Record<string, string> = { deal_price: "Sale price", commission_percent: "Commission %", commission_amount: "Commission amount" };
                  return (
                    <label key={field} style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                      {labels[field]}
                      <input type="number" className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft[field]} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} />
                    </label>
                  );
                })}
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)" }}>
                  Close date
                  <input type="date" className="crm-input" style={{ display: "block", width: "100%", marginTop: 3, fontSize: 13 }} value={draft.close_date} onChange={(e) => setDraft((d) => ({ ...d, close_date: e.target.value }))} />
                </label>
              </div>
            ) : (
              <div className="crm-lead-command-fact-grid">
                <MetricField label="Sale price" value={formatCurrency(dealPrice)} />
                <MetricField label="Commission %" value={formatPercentLabel(commissionPercent)} />
                <MetricField label="Commission amount" value={formatCurrency(commissionAmount)} />
                <MetricField label="Close date" value={firstNonEmpty(lead.close_date) || "Not scheduled yet"} />
              </div>
            )}

            <div className="crm-lead-command-inline-note">
              {hasDealDetails
                ? "Revenue details are tracked here once the lead becomes active business."
                : "Deal details can be added once this inquiry becomes active business."}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
