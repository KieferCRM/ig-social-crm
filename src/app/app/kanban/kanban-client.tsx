"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

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
  time_last_updated: string | null;
};

type LeadDraft = {
  stage: Stage;
  lead_temp: LeadTemp;
  intent: string;
  timeline: string;
  source: string;
  notes: string;
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
  if (phone) return phone;

  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) {
    return `@${lead.ig_username}`;
  }

  return "Unnamed lead";
}

function leadIdentityLine(lead: Lead): string {
  const bits: string[] = [];
  const email = firstNonEmpty(lead.canonical_email);
  const phone = firstNonEmpty(lead.canonical_phone);

  if (email) bits.push(email);
  if (phone) bits.push(phone);
  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) {
    bits.push(`@${lead.ig_username}`);
  }

  return bits.length > 0 ? bits.join(" • ") : "No contact details yet.";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function draftFromLead(lead: Lead): LeadDraft {
  return {
    stage: normalizeStage(lead.stage),
    lead_temp: normalizeLeadTemp(lead.lead_temp),
    intent: lead.intent || "",
    timeline: lead.timeline || "",
    source: lead.source || "",
    notes: lead.notes || "",
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
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,lead_temp,intent,timeline,source,stage,notes,time_last_updated"
        )
        .order("time_last_updated", { ascending: false });

      if (error) {
        setStatus("Could not load leads.");
        setLeads([]);
        setLoading(false);
        return;
      }

      const rows = ((data || []) as Lead[]).map((lead) => ({
        ...lead,
        stage: normalizeStage(lead.stage),
        lead_temp: normalizeLeadTemp(lead.lead_temp),
      }));

      setLeads(rows);
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
      setDraft((previous) => (previous ? { ...previous, stage: targetStage } : previous));
      setDraftDirty(true);
    }
  }

  async function saveLeadDraft() {
    if (!selectedLead || !draft) return;

    setSavingDraft(true);

    const ok = await persistLeadPatch(selectedLead.id, {
      stage: draft.stage,
      lead_temp: draft.lead_temp,
      intent: draft.intent || null,
      timeline: draft.timeline || null,
      source: draft.source || null,
      notes: draft.notes || null,
    });

    setSavingDraft(false);
    if (ok) {
      setDraftDirty(false);
      setStatus("Lead details saved.");
    }
  }

  if (loading) {
    return (
      <main className="crm-page">
        <div className="crm-card" style={{ padding: 16, color: "var(--ink-muted)" }}>
          Loading pipeline...
        </div>
      </main>
    );
  }

  if (leads.length === 0) {
    return (
      <main className="crm-page" style={{ maxWidth: 840 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>Pipeline</h1>
            <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)" }}>
              Leads will appear here once intake submissions or imports start coming in.
            </p>
          </div>
          <Link href="/app" className="crm-btn crm-btn-secondary">Dashboard</Link>
        </div>

        <div className="crm-card" style={{ marginTop: 14, padding: 18, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>No leads yet</div>
          <div style={{ fontSize: 14, color: "var(--ink-muted)" }}>
            Configure your questionnaire and run your first CSV import.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/app/intake" className="crm-btn crm-btn-primary">Open Lead Intake</Link>
            <Link href="/app/intake/import" className="crm-btn crm-btn-secondary">Open CSV Import</Link>
          </div>
        </div>
      </main>
    );
  }

  function openLeadDetail(leadId: string) {
    setSelectedLeadId(leadId);
    setIsDetailOpen(true);
  }

  return (
    <main className="crm-page" style={{ maxWidth: 1260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Pipeline</h1>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)" }}>
            Move leads across stages and keep profile details current.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/app/list" className="crm-btn crm-btn-secondary">Lead List</Link>
          <Link href="/app" className="crm-btn crm-btn-secondary">Dashboard</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, alignItems: "start", marginTop: 16 }}>
        {grouped.map((column) => (
          <section
            key={column.stage}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleDrop(column.stage, event)}
            className="crm-card"
            style={{ padding: 10, minHeight: 260 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{column.stage}</strong>
              <span className="crm-chip">{column.leads.length}</span>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
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
                  className="crm-card-muted"
                  style={{
                    textAlign: "left",
                    padding: 10,
                    border: selectedLeadId === lead.id && isDetailOpen ? "1px solid var(--accent)" : "1px solid var(--line)",
                    color: "var(--foreground)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{leadDisplayName(lead)}</div>
                  <div style={{ marginTop: 3, fontSize: 12, color: "var(--ink-muted)" }}>{leadIdentityLine(lead)}</div>
                  <div style={{ marginTop: 6, display: "inline-flex", fontSize: 11 }} className={`crm-chip ${normalizeLeadTemp(lead.lead_temp) === "Hot" ? "crm-chip-danger" : normalizeLeadTemp(lead.lead_temp) === "Warm" ? "crm-chip-warn" : "crm-chip"}`}>
                    {normalizeLeadTemp(lead.lead_temp)}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {isDetailOpen && selectedLead && draft ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(4, 10, 22, 0.72)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setIsDetailOpen(false)}
        >
          <section
            className="crm-card"
            style={{
              width: "min(680px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong>Lead Details</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="crm-btn crm-btn-secondary" style={{ padding: "6px 8px", fontSize: 12 }} onClick={() => setIsDetailOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{leadDisplayName(selectedLead)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>{leadIdentityLine(selectedLead)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                Last updated: {formatDate(selectedLead.time_last_updated)}
              </div>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Stage</span>
              <select
                value={draft.stage}
                onChange={(event) => {
                  setDraft((previous) => (previous ? { ...previous, stage: event.target.value as Stage } : previous));
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
          </section>
        </div>
      ) : null}

      {status ? <div style={{ marginTop: 10, color: status.includes("Could not") ? "var(--danger)" : "var(--ok)", fontSize: 13 }}>{status}</div> : null}
    </main>
  );
}
