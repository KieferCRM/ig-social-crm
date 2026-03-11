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
  initialLead?: (Partial<LeadDetail> & { id: string }) | null;
  onClose: () => void;
};

type PrimaryIdentity = {
  label: string;
  kind: "name" | "handle" | "email" | "phone" | "fallback";
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

function primaryIdentity(lead: LeadDetail): PrimaryIdentity {
  const full = firstNonEmpty(lead.full_name);
  if (full) return { label: full, kind: "name" };

  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return { label: combined, kind: "name" };

  const handle = cleanHandle(lead.ig_username);
  if (handle) return { label: handle, kind: "handle" };

  const email = firstNonEmpty(lead.canonical_email);
  if (email) return { label: email, kind: "email" };

  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) return { label: phone, kind: "phone" };

  return { label: "Unnamed lead", kind: "fallback" };
}

function secondaryIdentityLine(lead: LeadDetail, primaryKind: PrimaryIdentity["kind"]): string {
  const bits: string[] = [];
  const handle = cleanHandle(lead.ig_username);
  const email = firstNonEmpty(lead.canonical_email);
  const phone = firstNonEmpty(lead.canonical_phone);
  const source = sourceDisplayLabel(lead.source);

  if (handle && primaryKind !== "handle") bits.push(handle);
  if (email && primaryKind !== "email") bits.push(email);
  if (phone && primaryKind !== "phone") bits.push(phone);
  if (source) bits.push(source);

  return bits.slice(0, 3).join(" • ") || "Lead profile";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function tagsFromLead(lead: LeadDetail): string | null {
  if (Array.isArray(lead.tags) && lead.tags.length > 0) {
    return lead.tags.join(", ");
  }
  const tagText = lead.source_detail?.tags;
  if (typeof tagText === "string" && tagText.trim()) {
    return tagText.trim();
  }
  return null;
}

function summaryRows(lead: LeadDetail): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const stage = prettyLabel(lead.stage);
  const temp = prettyLabel(lead.lead_temp);
  const source = sourceDisplayLabel(lead.source);
  const intent = firstNonEmpty(lead.intent);
  const timeline = firstNonEmpty(lead.timeline);
  const location = firstNonEmpty(lead.location_area);
  const budget = firstNonEmpty(lead.budget_range);
  const nextStep = firstNonEmpty(lead.next_step);
  const tags = tagsFromLead(lead);

  if (stage) rows.push({ label: "Stage", value: stage });
  if (temp) rows.push({ label: "Temperature", value: temp });
  if (source) rows.push({ label: "Source", value: source });
  if (intent) rows.push({ label: "Intent", value: intent });
  if (timeline) rows.push({ label: "Timeline", value: timeline });
  if (location) rows.push({ label: "Location area", value: location });
  if (budget) rows.push({ label: "Budget range", value: budget });
  if (nextStep) rows.push({ label: "Next step", value: nextStep });
  if (tags) rows.push({ label: "Tags", value: tags });

  return rows;
}

function leadTempChipClass(leadTemp: string | null): string {
  const normalized = (leadTemp || "").trim().toLowerCase();
  if (normalized === "hot") return "crm-chip crm-chip-danger";
  if (normalized === "warm") return "crm-chip crm-chip-warn";
  return "crm-chip";
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-card-muted" style={{ padding: 10 }}>
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13 }}>{value}</div>
    </div>
  );
}

export default function LeadDetailPanel({ leadId, open, initialLead = null, onClose }: LeadDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [reminders, setReminders] = useState<ReminderPreview[]>([]);

  const seededLead = useMemo<LeadDetail | null>(() => {
    if (!initialLead) return null;
    return {
      id: initialLead.id,
      ig_username: initialLead.ig_username ?? null,
      full_name: initialLead.full_name ?? null,
      first_name: initialLead.first_name ?? null,
      last_name: initialLead.last_name ?? null,
      canonical_email: initialLead.canonical_email ?? null,
      canonical_phone: initialLead.canonical_phone ?? null,
      stage: initialLead.stage ?? null,
      lead_temp: initialLead.lead_temp ?? null,
      source: initialLead.source ?? null,
      intent: initialLead.intent ?? null,
      timeline: initialLead.timeline ?? null,
      budget_range: initialLead.budget_range ?? null,
      location_area: initialLead.location_area ?? null,
      contact_preference: initialLead.contact_preference ?? null,
      next_step: initialLead.next_step ?? null,
      notes: initialLead.notes ?? null,
      tags: Array.isArray(initialLead.tags) ? initialLead.tags : null,
      last_message_preview: initialLead.last_message_preview ?? null,
      time_last_updated: initialLead.time_last_updated ?? null,
      source_detail:
        initialLead.source_detail && typeof initialLead.source_detail === "object" && !Array.isArray(initialLead.source_detail)
          ? (initialLead.source_detail as Record<string, unknown>)
          : null,
      custom_fields:
        initialLead.custom_fields && typeof initialLead.custom_fields === "object" && !Array.isArray(initialLead.custom_fields)
          ? (initialLead.custom_fields as Record<string, unknown>)
          : null,
    };
  }, [initialLead]);

  useEffect(() => {
    if (!open || !leadId) return;
    setLead(seededLead);
    setReminders([]);
    setError("");
  }, [leadId, open, seededLead]);

  useEffect(() => {
    const selectedLeadId = leadId;
    if (!open || !selectedLeadId) return;
    let cancelled = false;

    async function loadLeadDetail(currentLeadId: string) {
      setLoading(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(`/api/leads/simple/${encodeURIComponent(currentLeadId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json()) as LeadDetailResponse;

        if (!response.ok || !data.lead) {
          if (!cancelled && !seededLead) {
            setError("Some details are unavailable right now.");
          }
          return;
        }

        if (!cancelled) {
          setLead(data.lead);
          setReminders(data.reminders || []);
        }
      } catch {
        if (!cancelled && !seededLead) {
          setError("Some details are unavailable right now.");
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    }

    void loadLeadDetail(selectedLeadId);
    return () => {
      cancelled = true;
    };
  }, [leadId, open, seededLead]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const displayLead = lead || seededLead;

  const headerIdentity = useMemo(() => {
    if (!displayLead) return null;
    const primary = primaryIdentity(displayLead);
    const secondary = secondaryIdentityLine(displayLead, primary.kind);
    return { primary, secondary };
  }, [displayLead]);

  const stageLabel = displayLead ? prettyLabel(displayLead.stage) : "";
  const tempLabel = displayLead ? prettyLabel(displayLead.lead_temp) : "";
  const sourceLabel = displayLead ? sourceDisplayLabel(displayLead.source) : "";

  const contactRows = useMemo(() => {
    if (!displayLead) return [] as Array<{ label: string; value: string }>;
    const rows: Array<{ label: string; value: string }> = [];
    const handle = cleanHandle(displayLead.ig_username);
    const email = firstNonEmpty(displayLead.canonical_email);
    const phone = firstNonEmpty(displayLead.canonical_phone);
    const contactPreference = firstNonEmpty(displayLead.contact_preference);

    if (handle) rows.push({ label: "Instagram", value: handle });
    if (phone) rows.push({ label: "Phone", value: phone });
    if (email) rows.push({ label: "Email", value: email });
    if (contactPreference) rows.push({ label: "Contact preference", value: contactPreference });

    return rows;
  }, [displayLead]);

  const leadSummary = useMemo(() => (displayLead ? summaryRows(displayLead) : []), [displayLead]);
  const notesText = firstNonEmpty(displayLead?.notes || null);
  const lastUpdatedText = formatDateTime(displayLead?.time_last_updated);
  const lastActivityText = firstNonEmpty(displayLead?.last_message_preview || null);
  const pendingReminders = reminders.filter((item) => item.status === "pending");
  const nextReminder = pendingReminders[0] || null;

  if (!open) return null;

  const twoColumnFieldGrid = {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 8,
  } as const;

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
        alignItems: "center",
        padding: "8px 0 8px 8px",
      }}
      onClick={onClose}
    >
      <aside
        className="crm-card"
        style={{
          width: "min(680px, 100%)",
          height: "calc(100dvh - 16px)",
          borderRadius: "14px 0 0 14px",
          borderLeft: "1px solid var(--line)",
          padding: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overscrollBehavior: "contain",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>Lead Details</div>
            <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800 }}>{headerIdentity?.primary.label || "Lead"}</div>
            {headerIdentity?.secondary ? (
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>{headerIdentity.secondary}</div>
            ) : null}
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stageLabel ? <span className="crm-chip">{stageLabel}</span> : null}
              {tempLabel ? <span className={leadTempChipClass(displayLead?.lead_temp || null)}>{tempLabel}</span> : null}
              {sourceLabel ? <span className="crm-chip">{sourceLabel}</span> : null}
            </div>
            {loading && displayLead ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-muted)" }}>Refreshing details...</div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
              Open in Pipeline
            </Link>
            <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
              Close
            </button>
          </div>
        </div>

        <div
          style={{
            overflowY: "auto",
            display: "grid",
            gap: 12,
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          {!displayLead && loading ? (
            <div className="crm-card-muted" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
              Loading lead details...
            </div>
          ) : null}

          {!displayLead && error ? (
            <div className="crm-card-muted" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
              Some details are unavailable right now.
            </div>
          ) : null}

          {displayLead ? (
            <>
              <section className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>Contact</div>
                {contactRows.length === 0 ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)" }}>
                    No direct contact details yet.
                  </div>
                ) : (
                  <div style={twoColumnFieldGrid}>
                    {contactRows.map((row) => (
                      <MiniField key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
                    ))}
                  </div>
                )}
              </section>

              <section className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>Lead Summary</div>
                {leadSummary.length === 0 ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)" }}>
                    Summary details are still being collected.
                  </div>
                ) : (
                  <div style={twoColumnFieldGrid}>
                    {leadSummary.map((row) => (
                      <MiniField key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
                    ))}
                  </div>
                )}
              </section>

              <section className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>Notes</div>
                <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>
                  {notesText || "No notes yet."}
                </div>
              </section>

              <section className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>Follow-Up</div>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <MiniField label="Reminders pending" value={String(pendingReminders.length)} />
                  <MiniField
                    label="Next reminder"
                    value={
                      nextReminder
                        ? `${formatDateTime(nextReminder.due_at)}${nextReminder.note ? ` • ${nextReminder.note}` : ""}`
                        : "No reminders scheduled."
                    }
                  />
                  <MiniField label="Recent activity" value={lastActivityText || "No recent activity yet."} />
                  {lastUpdatedText ? <MiniField label="Updated" value={lastUpdatedText} /> : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
