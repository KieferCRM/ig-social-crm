"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReminderPreview = {
  id: string;
  due_at: string;
  status: "pending" | "done" | string;
  note: string | null;
};

type LeadDetail = {
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
  source_detail: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
};

type LeadDetailResponse = {
  lead?: LeadDetail;
  reminders?: ReminderPreview[];
  error?: string;
};

type LeadDetailPanelProps = {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
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

function displayName(lead: LeadDetail): string {
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
  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) return `@${lead.ig_username}`;
  return "Unnamed lead";
}

function identityLine(lead: LeadDetail): string {
  const bits: string[] = [];
  const email = firstNonEmpty(lead.canonical_email);
  const phone = firstNonEmpty(lead.canonical_phone);
  if (email) bits.push(email);
  if (phone) bits.push(phone);
  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) bits.push(`@${lead.ig_username}`);
  return bits.length > 0 ? bits.join(" • ") : "Not provided";
}

function valueOrFallback(value: string | null | undefined): string {
  const text = firstNonEmpty(value);
  return text || "Not provided";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleString();
}

function tagsFromLead(lead: LeadDetail): string {
  if (Array.isArray(lead.tags) && lead.tags.length > 0) {
    return lead.tags.join(", ");
  }
  const tagFromSource = lead.source_detail?.tags;
  if (typeof tagFromSource === "string" && tagFromSource.trim()) {
    return tagFromSource.trim();
  }
  return "Not provided";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-card-muted" style={{ padding: 10 }}>
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13 }}>{value}</div>
    </div>
  );
}

export default function LeadDetailPanel({ leadId, open, onClose }: LeadDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [reminders, setReminders] = useState<ReminderPreview[]>([]);

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;

    async function loadLeadDetail() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/leads/simple/${encodeURIComponent(leadId)}`);
        const data = (await response.json()) as LeadDetailResponse;
        if (!response.ok || !data.lead) {
          if (!cancelled) {
            setLead(null);
            setReminders([]);
            setError(data.error || "Could not load lead details.");
          }
          return;
        }

        if (!cancelled) {
          setLead(data.lead);
          setReminders(data.reminders || []);
        }
      } catch {
        if (!cancelled) {
          setLead(null);
          setReminders([]);
          setError("Could not load lead details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLeadDetail();
    return () => {
      cancelled = true;
    };
  }, [leadId, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const pendingReminderCount = useMemo(
    () => reminders.filter((item) => item.status === "pending").length,
    [reminders]
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(4, 10, 22, 0.72)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <aside
        className="crm-card"
        style={{
          width: "min(560px, 100%)",
          height: "100%",
          borderRadius: 0,
          borderLeft: "1px solid var(--line)",
          padding: 14,
          overflowY: "auto",
          display: "grid",
          gap: 10,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Lead Details</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ padding: "6px 9px", fontSize: 12 }}>
              Open in Pipeline
            </Link>
            <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary" style={{ padding: "6px 9px", fontSize: 12 }}>
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="crm-card-muted" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
            Loading lead details...
          </div>
        ) : null}

        {error ? (
          <div className="crm-chip crm-chip-danger">{error}</div>
        ) : null}

        {!loading && lead ? (
          <>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName(lead)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>{identityLine(lead)}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="crm-chip">Stage: {valueOrFallback(lead.stage)}</span>
                <span className="crm-chip">Temp: {valueOrFallback(lead.lead_temp)}</span>
                <span className="crm-chip">Source: {valueOrFallback(lead.source)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <InfoRow label="Full name" value={displayName(lead)} />
              <InfoRow label="Instagram handle" value={lead.ig_username && !isSyntheticHandle(lead.ig_username) ? `@${lead.ig_username}` : "Not provided"} />
              <InfoRow label="Email" value={valueOrFallback(lead.canonical_email)} />
              <InfoRow label="Phone" value={valueOrFallback(lead.canonical_phone)} />
              <InfoRow label="Stage" value={valueOrFallback(lead.stage)} />
              <InfoRow label="Lead temperature" value={valueOrFallback(lead.lead_temp)} />
              <InfoRow label="Source" value={valueOrFallback(lead.source)} />
              <InfoRow label="Tags" value={tagsFromLead(lead)} />
              <InfoRow label="Intent" value={valueOrFallback(lead.intent)} />
              <InfoRow label="Timeline" value={valueOrFallback(lead.timeline)} />
              <InfoRow label="Location area" value={valueOrFallback(lead.location_area)} />
              <InfoRow label="Budget range" value={valueOrFallback(lead.budget_range)} />
              <InfoRow label="Contact preference" value={valueOrFallback(lead.contact_preference)} />
              <InfoRow label="Next step" value={valueOrFallback(lead.next_step)} />
              <InfoRow label="Last message" value={valueOrFallback(lead.last_message_preview)} />
              <InfoRow label="Updated at" value={formatDateTime(lead.time_last_updated)} />
            </div>

            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Notes</div>
              <div style={{ marginTop: 4, fontSize: 13, whiteSpace: "pre-wrap" }}>
                {valueOrFallback(lead.notes)}
              </div>
            </div>

            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Follow-up reminders</div>
                <span className={`crm-chip ${pendingReminderCount > 0 ? "crm-chip-warn" : ""}`}>
                  {pendingReminderCount} pending
                </span>
              </div>
              {reminders.length === 0 ? (
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)" }}>No reminders found.</div>
              ) : (
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {reminders.slice(0, 4).map((item) => (
                    <div key={item.id} style={{ fontSize: 13 }}>
                      {formatDateTime(item.due_at)} - {item.status} {item.note ? `- ${item.note}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
