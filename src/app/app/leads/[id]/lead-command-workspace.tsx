"use client";

import Link from "next/link";
import { useMemo } from "react";
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
  source_ref_id: string | null;
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
  tags: string[] | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
  last_communication_at?: string | null;
  created_at?: string | null;
  urgency_level?: string | null;
  urgency_score?: number | null;
  source_detail: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
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
};

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
  if (phone) return phone;

  return "Unnamed lead";
}

function leadTempChipClass(leadTemp: string | null): string {
  const normalized = (leadTemp || "").trim().toLowerCase();
  if (normalized === "hot") return "crm-chip crm-chip-danger";
  if (normalized === "warm") return "crm-chip crm-chip-warn";
  return "crm-chip";
}

function toPhoneActionValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^\d+]/g, "").trim();
  return normalized || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fieldLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function fieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => fieldValue(item)).filter(Boolean);
    return items.join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return "";
}

function recordRows(record: Record<string, unknown> | null): Array<{ key: string; label: string; value: string }> {
  if (!record) return [];
  return Object.entries(record)
    .map(([key, rawValue]) => ({
      key,
      label: fieldLabel(key),
      value: fieldValue(rawValue),
    }))
    .filter((row) => row.value)
    .slice(0, 24);
}

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-card-muted crm-lead-command-mini">
      <div className="crm-lead-command-mini-label">{label}</div>
      <div className="crm-lead-command-mini-value">{value}</div>
    </div>
  );
}

export default function LeadCommandWorkspace({ lead: initialLead, reminders }: LeadCommandWorkspaceProps) {
  const lead = initialLead;
  const displayName = useMemo(() => leadDisplayName(lead), [lead]);
  const phoneValue = firstNonEmpty(lead.canonical_phone);
  const phoneActionValue = toPhoneActionValue(phoneValue);
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
  const lastCommunicationText = formatDateTime(lead.last_communication_at);
  const lastUpdatedText = formatDateTime(lead.time_last_updated);
  const createdAtText = formatDateTime(lead.created_at);
  const sourceDetailRows = useMemo(() => recordRows(asRecord(lead.source_detail)), [lead.source_detail]);
  const customFieldRows = useMemo(() => recordRows(asRecord(lead.custom_fields)), [lead.custom_fields]);
  const tagsText =
    Array.isArray(lead.tags) && lead.tags.length > 0
      ? lead.tags.join(", ")
      : null;

  const recommendedAction = useMemo(() => {
    const stage = (lead.stage || "").trim().toLowerCase();
    const temp = (lead.lead_temp || "").trim().toLowerCase();
    if (stage === "new") return "Initial outreach now. First response speed is key.";
    if (temp === "hot") return "Contact today and secure a clear next step before this lead cools off.";
    if (pendingReminders.length > 0) return "Clear pending reminders so this lead does not slip.";
    if (!firstNonEmpty(lead.next_step)) return "Set a concrete next step after your next touchpoint.";
    return "Keep momentum moving with the next scheduled follow-up.";
  }, [lead.lead_temp, lead.next_step, lead.stage, pendingReminders.length]);

  const guidance = useMemo(() => {
    const items: string[] = [];
    const stage = (lead.stage || "").trim().toLowerCase();
    const temp = (lead.lead_temp || "").trim().toLowerCase();

    if (stage === "new") {
      items.push("Make first contact quickly. Fast response gives new inquiries the best chance to convert.");
    }
    if (temp === "hot") {
      items.push("This lead has urgency. Anchor the conversation around timing and the next scheduled step.");
    }
    if (!firstNonEmpty(lead.next_step)) {
      items.push("Set a next step as soon as you have contact so follow-up stays obvious.");
    }
    if (pendingReminders.length > 0) {
      items.push(`${pendingReminders.length} reminder(s) are pending. Clearing them keeps response speed tight.`);
    }
    if (!firstNonEmpty(lead.notes)) {
      items.push("Capture context after your first conversation so future follow-ups stay personal.");
    }

    return items.slice(0, 3);
  }, [lead.lead_temp, lead.next_step, lead.notes, lead.stage, pendingReminders.length]);

  const dealPrice = parsePositiveDecimal(lead.deal_price);
  const commissionPercent = parsePositiveDecimal(lead.commission_percent);
  const commissionAmount =
    parsePositiveDecimal(lead.commission_amount) ?? calculateCommissionAmount(dealPrice, commissionPercent);
  const hasDealDetails =
    dealPrice !== null || commissionPercent !== null || commissionAmount !== null || Boolean(firstNonEmpty(lead.close_date));

  return (
    <main className="crm-page crm-page-wide crm-lead-command-page">
      <section className="crm-card crm-section-card crm-lead-command-hero">
        <div className="crm-lead-command-hero-main">
          <div className="crm-lead-command-kicker">Lead Command Workspace</div>
          <h1 className="crm-lead-command-title">{displayName}</h1>
          <div className="crm-lead-command-contact-line">
            <span>{phoneValue || "No phone saved yet"}</span>
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
        </div>

        <div className="crm-lead-command-hero-actions">
          <div className="crm-lead-command-primary-actions">
            {phoneActionValue ? (
              <a href={`tel:${phoneActionValue}`} className="crm-btn crm-btn-primary">
                Call
              </a>
            ) : (
              <button type="button" className="crm-btn crm-btn-primary" disabled>
                Call
              </button>
            )}
            {emailValue ? (
              <a href={`mailto:${encodeURIComponent(emailValue)}`} className="crm-btn crm-btn-primary">
                Email
              </a>
            ) : (
              <button type="button" className="crm-btn crm-btn-primary" disabled>
                Email
              </button>
            )}
          </div>
          <div className="crm-lead-command-secondary-actions">
            <Link href="/app/kanban" className="crm-btn crm-btn-secondary">
              Open in Pipeline
            </Link>
            <ConvertToDealButton leadId={lead.id} defaultPropertyAddress={lead.location_area} />
            <Link href="/app/list" className="crm-btn crm-btn-secondary">
              Back to Leads
            </Link>
          </div>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-lead-command-next">
        <div className="crm-lead-command-next-copy">
          <div className="crm-lead-command-kicker">Next Best Action</div>
          <h2 className="crm-section-title">{recommendedAction}</h2>
          <p className="crm-section-subtitle">
            {guidance[0] || "Keep response speed high and lock in a concrete next step."}
          </p>
        </div>
        <div className="crm-lead-command-next-actions">
          {phoneActionValue ? (
            <a href={`tel:${phoneActionValue}`} className="crm-btn crm-btn-primary">
              Call Now
            </a>
          ) : null}
          {emailValue ? (
            <a href={`mailto:${encodeURIComponent(emailValue)}`} className="crm-btn crm-btn-secondary">
              Email Lead
            </a>
          ) : null}
          <Link href="/app/kanban" className="crm-btn crm-btn-secondary">
            Update Stage
          </Link>
        </div>
        {guidance.length > 1 ? (
          <div className="crm-lead-command-guidance-list">
            {guidance.slice(1).map((item) => (
              <div key={item} className="crm-lead-command-guidance-item">
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="crm-lead-command-layout">
        <div className="crm-lead-command-main-column">
          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Contact and Lead Details</h2>
                <p className="crm-section-subtitle">
                  The core information you need before making contact or moving the lead forward.
                </p>
              </div>
            </div>

            <div className="crm-lead-command-fact-grid">
              <MetricField label="Phone" value={phoneValue || "Not provided"} />
              <MetricField label="Email" value={emailValue || "Not provided"} />
              <MetricField label="Intent" value={firstNonEmpty(lead.intent) || "Not captured yet"} />
              <MetricField label="Timeline" value={firstNonEmpty(lead.timeline) || "Not captured yet"} />
              <MetricField label="Area" value={firstNonEmpty(lead.location_area) || "Not captured yet"} />
              <MetricField label="Budget" value={firstNonEmpty(lead.budget_range) || "Not captured yet"} />
            </div>
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
              {firstNonEmpty(lead.notes) ? (
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

            <div className="crm-lead-command-fact-grid">
              <MetricField label="Sale price" value={formatCurrency(dealPrice)} />
              <MetricField label="Commission %" value={formatPercentLabel(commissionPercent)} />
              <MetricField label="Commission amount" value={formatCurrency(commissionAmount)} />
              <MetricField label="Close date" value={firstNonEmpty(lead.close_date) || "Not scheduled yet"} />
            </div>

            <div className="crm-lead-command-inline-note">
              {hasDealDetails
                ? "Revenue details are tracked here once the lead becomes active business."
                : "Deal details can be added once this inquiry becomes active business."}
            </div>
          </section>

          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Follow-Ups and Reminders</h2>
                <p className="crm-section-subtitle">
                  The next move, reminder cadence, and contact preference in one place.
                </p>
              </div>
            </div>

            <div className="crm-lead-command-follow-grid">
              <MetricField label="Recommended move" value={recommendedAction} />
              <MetricField
                label="Next step"
                value={firstNonEmpty(lead.next_step) || "Set a concrete next step after your next touchpoint."}
              />
              <MetricField
                label="Contact preference"
                value={firstNonEmpty(lead.contact_preference) || "Not set yet"}
              />
              <MetricField
                label="Next reminder"
                value={
                  nextReminder
                    ? `${formatDateTime(nextReminder.due_at)}${nextReminder.note ? ` • ${nextReminder.note}` : ""}`
                    : "No reminder scheduled yet."
                }
              />
            </div>

            <div className="crm-lead-command-reminder-stack">
              <div className="crm-lead-command-stack-head">
                <strong>Pending reminders</strong>
                <span className="crm-chip">{pendingReminders.length}</span>
              </div>
              {pendingReminders.length === 0 ? (
                <div className="crm-lead-command-empty">
                  No reminders scheduled. Add one after contact so this lead never goes cold.
                </div>
              ) : (
                pendingReminders.slice(0, 4).map((reminder) => (
                  <div key={reminder.id} className="crm-card crm-lead-command-reminder-card">
                    <div className="crm-lead-command-reminder-time">{formatDateTime(reminder.due_at)}</div>
                    <div className="crm-lead-command-reminder-note">{reminder.note || "Follow-up reminder"}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="crm-card crm-section-card">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Recent Activity</h2>
                <p className="crm-section-subtitle">
                  Quick context before you call, text, or move the lead.
                </p>
              </div>
            </div>
            <div className="crm-lead-command-follow-grid">
              <MetricField label="Last message" value={firstNonEmpty(lead.last_message_preview) || "No recent message saved"} />
              <MetricField label="Last communication" value={lastCommunicationText || "No communication logged"} />
              <MetricField label="Profile updated" value={lastUpdatedText || "No timestamp available"} />
              <MetricField label="Lead created" value={createdAtText || "No timestamp available"} />
            </div>
          </section>
        </div>
      </div>

      <details className="crm-card crm-section-card crm-lead-command-advanced">
        <summary className="crm-lead-command-advanced-summary">Advanced Data</summary>
        <div className="crm-lead-command-advanced-body">
          <div className="crm-lead-command-fact-grid">
            <MetricField label="Source reference" value={firstNonEmpty(lead.source_ref_id) || "Not provided"} />
            <MetricField label="Tags" value={tagsText || "No tags"} />
            <MetricField label="Created" value={createdAtText || "No timestamp available"} />
            <MetricField label="Updated" value={lastUpdatedText || "No timestamp available"} />
          </div>

          <div className="crm-lead-command-advanced-grid">
            <section className="crm-card-muted crm-lead-command-advanced-panel">
              <div className="crm-section-head">
                <h3 className="crm-section-title">Source Data</h3>
              </div>
              <div className="crm-lead-command-advanced-stack">
                {sourceDetailRows.length > 0 ? (
                  sourceDetailRows.map((row) => <MetricField key={row.key} label={row.label} value={row.value} />)
                ) : (
                  <div className="crm-lead-command-empty">No structured source data yet.</div>
                )}
              </div>
            </section>

            <section className="crm-card-muted crm-lead-command-advanced-panel">
              <div className="crm-section-head">
                <h3 className="crm-section-title">Imported Details</h3>
              </div>
              <div className="crm-lead-command-advanced-stack">
                {customFieldRows.length > 0 ? (
                  customFieldRows.map((row) => <MetricField key={row.key} label={row.label} value={row.value} />)
                ) : (
                  <div className="crm-lead-command-empty">No custom fields stored for this lead.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </details>
    </main>
  );
}
