"use client";

import { useMemo, useState } from "react";

type LeadOption = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
};

function asText(value: string | null | undefined): string {
  return (value || "").trim();
}

function isSyntheticHandle(handle: string | null): boolean {
  if (!handle) return false;
  const value = handle.trim().toLowerCase();
  if (!value) return false;
  if (/^(import|intake|manual|event)_lead_[0-9a-f]{8}$/.test(value)) return true;
  if (/^(import|intake|manual)_[a-z0-9_]+_[0-9a-f]{8}$/.test(value)) return true;
  return false;
}

function pretty(value: string | null | undefined, fallback: string): string {
  const text = asText(value) || fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function leadPrimaryLabel(lead: LeadOption): string {
  const full = asText(lead.full_name);
  if (full) return full;

  const first = asText(lead.first_name);
  const last = asText(lead.last_name);
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;

  const handle = asText(lead.ig_username);
  if (handle && !isSyntheticHandle(handle)) return `@${handle.replace(/^@+/, "")}`;

  const email = asText(lead.canonical_email);
  if (email) return email;

  const phone = asText(lead.canonical_phone);
  if (phone) return phone;

  if (handle) return `@${handle.replace(/^@+/, "")}`;

  return `Lead ${lead.id.slice(0, 8)}`;
}

function leadOptionLabel(lead: LeadOption): string {
  const primary = leadPrimaryLabel(lead);
  const stage = pretty(lead.stage, "New");
  const temp = pretty(lead.lead_temp, "Warm");
  const contact = asText(lead.canonical_phone) || asText(lead.canonical_email);
  return [primary, stage, temp, contact].filter(Boolean).join(" — ");
}

function leadDetailLine(lead: LeadOption, kind: "email" | "phone" | "handle"): string {
  if (kind === "email") return asText(lead.canonical_email) || "None";
  if (kind === "phone") return asText(lead.canonical_phone) || "None";
  const handle = asText(lead.ig_username);
  return handle ? `@${handle.replace(/^@+/, "")}` : "None";
}

function LeadPreviewCard({ title, lead }: { title: string; lead: LeadOption }) {
  return (
    <div className="crm-card-muted" style={{ padding: 10, display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>{title}</div>
      <div style={{ fontWeight: 700 }}>{leadPrimaryLabel(lead)}</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Stage: {pretty(lead.stage, "New")}</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Temperature: {pretty(lead.lead_temp, "Warm")}</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Email: {leadDetailLine(lead, "email")}</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Phone: {leadDetailLine(lead, "phone")}</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Handle: {leadDetailLine(lead, "handle")}</div>
    </div>
  );
}

export default function MergeTool({ leads }: { leads: LeadOption[] }) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const sourceLead = useMemo(() => leads.find((lead) => lead.id === sourceId) || null, [leads, sourceId]);
  const targetLead = useMemo(() => leads.find((lead) => lead.id === targetId) || null, [leads, targetId]);
  const sameLead = sourceId !== "" && targetId !== "" && sourceId === targetId;
  const readyToConfirm = Boolean(sourceLead && targetLead && !sameLead);
  const canMerge = readyToConfirm && confirmChecked && !working;

  async function merge() {
    if (!readyToConfirm) {
      setMessage("Select two different leads before merging.");
      return;
    }
    if (!confirmChecked) {
      setMessage("Confirm this is a true duplicate merge before continuing.");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_lead_id: sourceId, target_lead_id: targetId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error || "Merge failed.");
        return;
      }
      setMessage("Merge complete. Duplicate lead archived and primary lead kept.");
      setTimeout(() => window.location.reload(), 700);
    } catch {
      setMessage("Merge failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="crm-card crm-section-card crm-stack-10">
      <div className="crm-section-head">
        <h2 className="crm-section-title">Lead Merge Tool</h2>
      </div>
      <div className="crm-section-subtitle">
        Merge duplicate leads into one clean record. Choose the duplicate lead to remove and the lead you want to keep.
        Reminders and useful details should move into the kept record.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>
            Duplicate Lead (will be removed)
          </span>
          <select
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
              setConfirmChecked(false);
              setMessage("");
            }}
            style={{ padding: 9 }}
          >
            <option value="">Select duplicate lead</option>
            {leads.map((lead) => (
              <option key={`source-${lead.id}`} value={lead.id}>
                {leadOptionLabel(lead)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>
            Primary Lead (will be kept)
          </span>
          <select
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value);
              setConfirmChecked(false);
              setMessage("");
            }}
            style={{ padding: 9 }}
          >
            <option value="">Select primary lead</option>
            {leads.map((lead) => (
              <option key={`target-${lead.id}`} value={lead.id}>
                {leadOptionLabel(lead)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sameLead ? (
        <div className="crm-chip crm-chip-danger" style={{ marginTop: 10 }}>
          Duplicate and primary lead cannot be the same record.
        </div>
      ) : null}

      {readyToConfirm && sourceLead && targetLead ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <LeadPreviewCard title="Duplicate Preview" lead={sourceLead} />
            <LeadPreviewCard title="Primary Preview" lead={targetLead} />
          </div>

          <div className="crm-card-muted" style={{ padding: 10, border: "1px solid var(--danger)" }}>
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              This will remove the duplicate lead and keep the primary lead. This action should only be used for true duplicates.
            </div>
            <label style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(event) => setConfirmChecked(event.target.checked)}
              />
              I confirm these are true duplicates.
            </label>
          </div>
        </>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => void merge()}
          disabled={!canMerge}
          className="crm-btn crm-btn-primary"
          style={{ padding: "8px 12px" }}
        >
          {working ? "Merging..." : "Merge Leads"}
        </button>
      </div>

      {message ? (
        <div
          style={{ marginTop: 8, fontSize: 13, color: message.toLowerCase().includes("failed") ? "var(--danger)" : "var(--ok)" }}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
