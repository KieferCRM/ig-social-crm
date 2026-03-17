"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  asInputDate,
  asInputNumber,
  calculateCommissionAmount,
  formatCurrency,
  formatPercentLabel,
  parsePositiveDecimal,
} from "@/lib/deal-metrics";

const STAGES = ["New", "Contacted", "Qualified", "Closed"] as const;
const LEAD_TEMPS = ["Cold", "Warm", "Hot"] as const;

type Stage = (typeof STAGES)[number];
type LeadTemp = (typeof LEAD_TEMPS)[number];

type Lead = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  lead_temp: string | null;
  intent: string | null;
  timeline: string | null;
  source: string | null;
  stage: string | null;
  notes: string | null;
  deal_price: number | string | null;
  commission_percent: number | string | null;
  commission_amount: number | string | null;
  close_date: string | null;
  time_last_updated: string | null;
};

type LeadDraft = {
  stage: Stage;
  lead_temp: LeadTemp;
  intent: string;
  timeline: string;
  source: string;
  notes: string;
  deal_price: string;
  commission_percent: string;
  commission_amount: string;
  close_date: string;
  commissionAmountManuallyEdited: boolean;
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

function normalizeStage(value: string | null): Stage {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "new") return "New";
  if (normalized === "contacted") return "Contacted";
  if (normalized === "qualified") return "Qualified";
  if (normalized === "closed") return "Closed";
  return "New";
}

function normalizeLeadTemp(value: string | null): LeadTemp {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "cold") return "Cold";
  if (normalized === "hot") return "Hot";
  return "Warm";
}

function leadDisplayName(lead: Lead): string {
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

function formatPhoneDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return trimmed;

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function leadSecondaryLine(lead: Lead): string {
  const email = firstNonEmpty(lead.canonical_email);
  if (email) return email;

  const phone = formatPhoneDisplay(lead.canonical_phone);
  if (phone) return phone;

  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) {
    return `@${lead.ig_username}`;
  }

  const intent = firstNonEmpty(lead.intent);
  const timeline = firstNonEmpty(lead.timeline);
  if (intent && timeline) return `${intent} • ${timeline}`;
  if (intent) return intent;
  if (timeline) return timeline;

  const source = firstNonEmpty(lead.source);
  if (source) return source;

  return "No contact details yet";
}

function leadBadgeClass(leadTemp: string | null): string {
  const normalized = normalizeLeadTemp(leadTemp);
  if (normalized === "Hot") return "crm-chip crm-chip-danger";
  if (normalized === "Warm") return "crm-chip crm-chip-warn";
  return "crm-chip";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function draftFromLead(lead: Lead): LeadDraft {
  const price = parsePositiveDecimal(lead.deal_price);
  const percent = parsePositiveDecimal(lead.commission_percent);
  const storedCommission = parsePositiveDecimal(lead.commission_amount);
  const calculatedCommission = calculateCommissionAmount(price, percent);

  let commissionAmountManuallyEdited = false;
  if (storedCommission !== null) {
    if (calculatedCommission === null) {
      commissionAmountManuallyEdited = true;
    } else {
      commissionAmountManuallyEdited = Math.abs(storedCommission - calculatedCommission) > 0.01;
    }
  }

  return {
    stage: normalizeStage(lead.stage),
    lead_temp: normalizeLeadTemp(lead.lead_temp),
    intent: lead.intent || "",
    timeline: lead.timeline || "",
    source: lead.source || "",
    notes: lead.notes || "",
    deal_price: asInputNumber(price),
    commission_percent: asInputNumber(percent, 3),
    commission_amount:
      asInputNumber(storedCommission ?? (commissionAmountManuallyEdited ? null : calculatedCommission)),
    close_date: asInputDate(lead.close_date),
    commissionAmountManuallyEdited,
  };
}

export default function KanbanClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const draggedLeadIdRef = useRef<string | null>(null);

  const supabase = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    async function loadLeads() {
      const selections = [
        "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,lead_temp,intent,timeline,source,stage,notes,deal_price,commission_percent,commission_amount,close_date,time_last_updated",
        "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,lead_temp,intent,timeline,source,stage,notes,time_last_updated",
      ];

      let loaded = false;
      for (const select of selections) {
        const { data, error } = await supabase
          .from("leads")
          .select(select)
          .order("time_last_updated", { ascending: false });

        if (error) continue;

        const rawRows: unknown[] = Array.isArray(data) ? (data as unknown[]) : [];
        const rows = rawRows
          .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
          .map((row) => {
            const lead = row as Partial<Lead>;
            return {
              id: String(lead.id || ""),
              ig_username: (lead.ig_username as string | null) ?? null,
              full_name: (lead.full_name as string | null) ?? null,
              first_name: (lead.first_name as string | null) ?? null,
              last_name: (lead.last_name as string | null) ?? null,
              canonical_email: (lead.canonical_email as string | null) ?? null,
              canonical_phone: (lead.canonical_phone as string | null) ?? null,
              lead_temp: normalizeLeadTemp((lead.lead_temp as string | null) ?? null),
              intent: (lead.intent as string | null) ?? null,
              timeline: (lead.timeline as string | null) ?? null,
              source: (lead.source as string | null) ?? null,
              stage: normalizeStage((lead.stage as string | null) ?? null),
              notes: (lead.notes as string | null) ?? null,
              deal_price: (lead.deal_price as number | string | null) ?? null,
              commission_percent: (lead.commission_percent as number | string | null) ?? null,
              commission_amount: (lead.commission_amount as number | string | null) ?? null,
              close_date: (lead.close_date as string | null) ?? null,
              time_last_updated: (lead.time_last_updated as string | null) ?? null,
            } satisfies Lead;
          })
          .filter((lead) => lead.id.length > 0);

        setLeads(rows);
        loaded = true;
        break;
      }

      if (!loaded) {
        setStatus("Could not load leads.");
        setLeads([]);
      }
      setLoading(false);
    }

    void loadLeads();
  }, [supabase]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  useEffect(() => {
    if (!selectedLead) {
      setDraft(null);
      setDraftDirty(false);
      return;
    }
    setDraft(draftFromLead(selectedLead));
    setDraftDirty(false);
  }, [selectedLeadId, selectedLead]);

  useEffect(() => {
    if (!isDetailOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDetailOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDetailOpen]);

  const grouped = useMemo(() => {
    return STAGES.map((stage) => ({
      stage,
      leads: leads
        .filter((lead) => normalizeStage(lead.stage) === stage)
        .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || "")),
    }));
  }, [leads]);
  const hotLeadCount = useMemo(
    () => leads.filter((lead) => normalizeLeadTemp(lead.lead_temp) === "Hot").length,
    [leads]
  );

  function autoCommissionAmountValue(dealPriceInput: string, commissionPercentInput: string): string {
    const amount = calculateCommissionAmount(
      parsePositiveDecimal(dealPriceInput),
      parsePositiveDecimal(commissionPercentInput)
    );
    return asInputNumber(amount);
  }

  function updateDealPrice(value: string) {
    setDraft((previous) => {
      if (!previous) return previous;
      const next = { ...previous, deal_price: value };
      if (!next.commissionAmountManuallyEdited) {
        next.commission_amount = autoCommissionAmountValue(next.deal_price, next.commission_percent);
      }
      return next;
    });
    setDraftDirty(true);
  }

  function updateCommissionPercent(value: string) {
    setDraft((previous) => {
      if (!previous) return previous;
      const next = { ...previous, commission_percent: value };
      if (!next.commissionAmountManuallyEdited) {
        next.commission_amount = autoCommissionAmountValue(next.deal_price, next.commission_percent);
      }
      return next;
    });
    setDraftDirty(true);
  }

  function updateCommissionAmount(value: string) {
    setDraft((previous) => {
      if (!previous) return previous;

      const trimmed = value.trim();
      if (!trimmed) {
        const next = { ...previous };
        next.commissionAmountManuallyEdited = false;
        next.commission_amount = autoCommissionAmountValue(next.deal_price, next.commission_percent);
        return next;
      }

      return {
        ...previous,
        commission_amount: value,
        commissionAmountManuallyEdited: true,
      };
    });
    setDraftDirty(true);
  }

  function patchLeadLocal(leadId: string, patch: Partial<Lead>) {
    setLeads((previous) =>
      previous.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead))
    );
  }

  async function persistLeadPatch(leadId: string, patch: Partial<Lead>) {
    const previous = leads;
    const updatedAt = new Date().toISOString();
    const nextPatch: Partial<Lead> = { ...patch, time_last_updated: updatedAt };

    patchLeadLocal(leadId, nextPatch);

    const { error } = await supabase
      .from("leads")
      .update({ ...nextPatch, time_last_updated: updatedAt })
      .eq("id", leadId);

    if (error) {
      setLeads(previous);
      setStatus("Could not save lead changes. Reverted.");
      return false;
    }

    setStatus("");
    return true;
  }

  async function handleDrop(targetStage: Stage, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const idFromTransfer = event.dataTransfer.getData("text/plain");
    const leadId = idFromTransfer || draggedLeadIdRef.current;
    draggedLeadIdRef.current = null;

    if (!leadId) return;
    const current = leads.find((lead) => lead.id === leadId);
    if (!current) return;

    const currentStage = normalizeStage(current.stage);
    if (currentStage === targetStage) return;

    void persistLeadPatch(leadId, { stage: targetStage });

    if (selectedLeadId === leadId) {
      setDraft((previous) => {
        if (!previous) return previous;
        const next = { ...previous, stage: targetStage };
        if (targetStage === "Closed" && !next.close_date) {
          next.close_date = new Date().toISOString().slice(0, 10);
        }
        return next;
      });
      setDraftDirty(true);
    }
  }

  async function saveLeadDraft() {
    if (!selectedLead || !draft) return;

    const dealPrice = parsePositiveDecimal(draft.deal_price);
    const commissionPercent = parsePositiveDecimal(draft.commission_percent);
    let commissionAmount = parsePositiveDecimal(draft.commission_amount);
    if (!draft.commissionAmountManuallyEdited && commissionAmount === null) {
      commissionAmount = calculateCommissionAmount(dealPrice, commissionPercent);
    }

    let closeDate: string | null = null;
    if (draft.close_date.trim()) {
      const date = new Date(draft.close_date);
      if (Number.isNaN(date.getTime())) {
        setStatus("Close date must be a valid date.");
        return;
      }
      closeDate = date.toISOString().slice(0, 10);
    }

    setSavingDraft(true);

    const patch: Partial<Lead> = {
      stage: draft.stage,
      lead_temp: draft.lead_temp,
      intent: draft.intent || null,
      timeline: draft.timeline || null,
      source: draft.source || null,
      notes: draft.notes || null,
    };

    const hasDealInputs =
      draft.stage === "Closed" ||
      draft.deal_price.trim().length > 0 ||
      draft.commission_percent.trim().length > 0 ||
      draft.commission_amount.trim().length > 0 ||
      draft.close_date.trim().length > 0;

    if (hasDealInputs) {
      patch.deal_price = dealPrice;
      patch.commission_percent = commissionPercent;
      patch.commission_amount = commissionAmount;
      patch.close_date = closeDate;
    }

    const ok = await persistLeadPatch(selectedLead.id, patch);

    setSavingDraft(false);
    if (ok) {
      setDraftDirty(false);
      setStatus("Lead details saved.");
    }
  }

  if (loading) {
    return (
      <main className="crm-page">
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading pipeline...</div>
        </section>
      </main>
    );
  }

  if (leads.length === 0) {
    return (
      <main className="crm-page" style={{ maxWidth: 840 }}>
        <section className="crm-card crm-section-card">
          <div className="crm-page-header">
            <div className="crm-page-header-main">
              <h1 className="crm-page-title">Pipeline</h1>
              <p className="crm-page-subtitle">
                Leads will appear here once your intake form or imports start feeding LockboxHQ.
              </p>
            </div>
            <div className="crm-page-actions">
              <Link href="/app/intake" className="crm-btn crm-btn-primary">Open intake</Link>
            </div>
          </div>
        </section>

        <EmptyState
          title="No leads in the pipeline yet"
          body="Share your intake link or import an existing list so LockboxHQ has real inquiries to organize."
          action={
            <div className="crm-inline-actions">
              <Link href="/app/intake" className="crm-btn crm-btn-primary">Open intake</Link>
              <Link href="/app/intake/import" className="crm-btn crm-btn-secondary">Open CSV import</Link>
            </div>
          }
        />
      </main>
    );
  }

  function openLeadDetail(leadId: string) {
    setSelectedLeadId(leadId);
    setIsDetailOpen(true);
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Pipeline</h1>
            <p className="crm-page-subtitle">
              Move serious inquiries forward and keep stage, urgency, and notes current.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/list" className="crm-btn crm-btn-secondary">Open leads</Link>
            <Link href="/app/intake" className="crm-btn crm-btn-secondary">Open intake</Link>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Total leads</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{leads.length}</div>
        </article>
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>New</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{grouped.find((column) => column.stage === "New")?.leads.length || 0}</div>
        </article>
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Qualified</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{grouped.find((column) => column.stage === "Qualified")?.leads.length || 0}</div>
        </article>
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Hot leads</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{hotLeadCount}</div>
        </article>
      </section>

      <section className="crm-kanban-board">
        {grouped.map((column) => (
          <article
            key={column.stage}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleDrop(column.stage, event)}
            className="crm-card crm-section-card crm-kanban-column"
          >
            <div className="crm-section-head">
              <h2 className="crm-section-title">{column.stage}</h2>
              <span className="crm-chip">{column.leads.length}</span>
            </div>

            <div className="crm-stack-8">
              {column.leads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    const id = String(lead.id);
                    draggedLeadIdRef.current = id;
                    event.dataTransfer.setData("text/plain", id);
                  }}
                  onClick={() => openLeadDetail(lead.id)}
                  className={`crm-card-muted crm-kanban-card${
                    selectedLeadId === lead.id && isDetailOpen ? " crm-kanban-card-selected" : ""
                  }`}
                >
                  <div className="crm-kanban-card-head">
                    <div className="crm-kanban-card-copy">
                      <div className="crm-kanban-card-name">{leadDisplayName(lead)}</div>
                      <div className="crm-kanban-card-context">{leadSecondaryLine(lead)}</div>
                    </div>
                    <span className={leadBadgeClass(lead.lead_temp)}>{normalizeLeadTemp(lead.lead_temp)}</span>
                  </div>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      {isDetailOpen && selectedLead && draft ? (
        <div
          className="crm-kanban-editor-overlay"
          onClick={() => setIsDetailOpen(false)}
        >
          <section
            className="crm-card crm-kanban-editor-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-kanban-editor-header">
              <div>
                <div className="crm-lead-command-kicker">Pipeline quick edit</div>
                <strong className="crm-section-title">Quick Edit</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/app/leads/${selectedLead.id}`} className="crm-btn crm-btn-secondary" style={{ padding: "6px 8px", fontSize: 12 }}>
                  Open full workspace
                </Link>
                <button type="button" className="crm-btn crm-btn-secondary" style={{ padding: "6px 8px", fontSize: 12 }} onClick={() => setIsDetailOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="crm-kanban-editor-scroll">
            <div className="crm-card-muted crm-kanban-editor-summary">
              <div style={{ fontWeight: 700 }}>{leadDisplayName(selectedLead)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>{leadSecondaryLine(selectedLead)}</div>
              <div className="crm-kanban-editor-summary-badges">
                <span className="crm-chip">{normalizeStage(selectedLead.stage)}</span>
                <span className={leadBadgeClass(selectedLead.lead_temp)}>{normalizeLeadTemp(selectedLead.lead_temp)}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                Last updated: {formatDate(selectedLead.time_last_updated)}
              </div>
            </div>

            <section className="crm-card-muted crm-kanban-editor-section">
              <div className="crm-section-head">
                <div>
                  <strong className="crm-section-title">Lead basics</strong>
                  <div className="crm-section-subtitle">Keep stage, source, and urgency current.</div>
                </div>
              </div>
              <div className="crm-kanban-editor-grid">
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Stage</span>
                  <select
                    value={draft.stage}
                    onChange={(event) => {
                      const nextStage = event.target.value as Stage;
                      setDraft((previous) => {
                        if (!previous) return previous;
                        const next = { ...previous, stage: nextStage };
                        if (nextStage === "Closed" && !next.close_date) {
                          next.close_date = new Date().toISOString().slice(0, 10);
                        }
                        return next;
                      });
                      setDraftDirty(true);
                    }}
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Temperature</span>
                  <select
                    value={draft.lead_temp}
                    onChange={(event) => {
                      setDraft((previous) => (previous ? { ...previous, lead_temp: event.target.value as LeadTemp } : previous));
                      setDraftDirty(true);
                    }}
                  >
                    {LEAD_TEMPS.map((temp) => (
                      <option key={temp} value={temp}>
                        {temp}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Source</span>
                  <input
                    value={draft.source}
                    onChange={(event) => {
                      setDraft((previous) => (previous ? { ...previous, source: event.target.value } : previous));
                      setDraftDirty(true);
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="crm-card-muted crm-kanban-editor-section">
              <div className="crm-section-head">
                <div>
                  <strong className="crm-section-title">Qualification</strong>
                  <div className="crm-section-subtitle">Capture the context you need to move the lead forward.</div>
                </div>
              </div>
              <div className="crm-kanban-editor-grid">
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Intent</span>
                  <input
                    value={draft.intent}
                    onChange={(event) => {
                      setDraft((previous) => (previous ? { ...previous, intent: event.target.value } : previous));
                      setDraftDirty(true);
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Timeline</span>
                  <input
                    value={draft.timeline}
                    onChange={(event) => {
                      setDraft((previous) => (previous ? { ...previous, timeline: event.target.value } : previous));
                      setDraftDirty(true);
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="crm-card-muted crm-kanban-editor-section">
              <div className="crm-section-head">
                <div>
                  <strong className="crm-section-title">Notes</strong>
                  <div className="crm-section-subtitle">Keep enough context here for the next touchpoint.</div>
                </div>
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Notes</span>
                <textarea
                  rows={5}
                  value={draft.notes}
                  onChange={(event) => {
                    setDraft((previous) => (previous ? { ...previous, notes: event.target.value } : previous));
                    setDraftDirty(true);
                  }}
                />
              </label>
            </section>

            {draft.stage === "Closed" ? (
              <section className="crm-card-muted crm-kanban-editor-section" style={{ display: "grid", gap: 10 }}>
                <div className="crm-section-head">
                  <div>
                    <strong className="crm-section-title">Deal details</strong>
                    <div className="crm-section-subtitle">Keep revenue details here once the lead is actual business.</div>
                  </div>
                  <span className="crm-chip crm-chip-ok">Closed Lead</span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 8,
                  }}
                >
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Sale Price</span>
                    <input
                      inputMode="decimal"
                      placeholder="450000"
                      value={draft.deal_price}
                      onChange={(event) => updateDealPrice(event.target.value)}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Commission %</span>
                    <input
                      inputMode="decimal"
                      placeholder="3"
                      value={draft.commission_percent}
                      onChange={(event) => updateCommissionPercent(event.target.value)}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Commission Amount</span>
                    <input
                      inputMode="decimal"
                      placeholder="13500"
                      value={draft.commission_amount}
                      onChange={(event) => updateCommissionAmount(event.target.value)}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Close Date</span>
                    <input
                      type="date"
                      value={draft.close_date}
                      onChange={(event) => {
                        setDraft((previous) => (previous ? { ...previous, close_date: event.target.value } : previous));
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="crm-chip">
                    Deal Value: {formatCurrency(parsePositiveDecimal(draft.deal_price))}
                  </span>
                  <span className="crm-chip">
                    Commission Rate: {formatPercentLabel(parsePositiveDecimal(draft.commission_percent))}
                  </span>
                  <span className={draft.commissionAmountManuallyEdited ? "crm-chip crm-chip-info" : "crm-chip crm-chip-ok"}>
                    {draft.commissionAmountManuallyEdited ? "Commission amount is manually set" : "Commission auto-calculated from price and %"}
                  </span>
                </div>
              </section>
            ) : (
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                Deal details appear when the lead stage is set to Closed.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={savingDraft || !draftDirty}
                onClick={() => void saveLeadDraft()}
              >
                {savingDraft ? "Saving..." : "Save Changes"}
              </button>
              {draftDirty ? <span className="crm-chip crm-chip-warn">Unsaved changes</span> : <span className="crm-chip crm-chip-ok">Saved</span>}
            </div>
            </div>
          </section>
        </div>
      ) : null}

      {status ? <div style={{ color: status.includes("Could not") ? "var(--danger)" : "var(--ok)", fontSize: 13 }}>{status}</div> : null}
    </main>
  );
}
