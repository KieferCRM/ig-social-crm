"use client";

import { useState } from "react";
import type { LeadListRow } from "./lead-list-table";

type CreateLeadResponse = {
  lead?: LeadListRow;
  error?: string;
};

export default function ManualLeadForm({
  onSaved,
  onCancel,
}: {
  onSaved?: (lead: LeadListRow) => void;
  onCancel?: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [intent, setIntent] = useState("");
  const [timeline, setTimeline] = useState("");
  const [source, setSource] = useState("manual");
  const [stage, setStage] = useState("New");
  const [leadTemp, setLeadTemp] = useState("Warm");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveLead() {
    const handle = igUsername.trim();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!handle && !cleanName && !cleanEmail && !cleanPhone) {
      setMessage("Add at least one identity field: name, email, phone, or handle.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/leads/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ig_username: handle || null,
          full_name: cleanName || null,
          email: cleanEmail || null,
          phone: cleanPhone || null,
          tags: tags.trim() || null,
          intent: intent || null,
          timeline: timeline || null,
          source: source || "manual",
          lead_temp: leadTemp || "Warm",
          stage: stage || "New",
        }),
      });

      const data = (await response.json()) as CreateLeadResponse;
      if (!response.ok || !data.lead) {
        setMessage(data.error || "Could not save lead.");
        return;
      }

      setMessage(`Saved ${cleanName || cleanEmail || cleanPhone || `@${data.lead.ig_username}`}`);
      setFullName("");
      setEmail("");
      setPhone("");
      setTags("");
      setIgUsername("");
      setIntent("");
      setTimeline("");
      onSaved?.(data.lead);
    } catch {
      setMessage("Could not save lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="crm-card crm-section-card crm-stack-10">
      <div className="crm-section-head">
        <h2 className="crm-section-title">Add Lead Manually</h2>
      </div>
      <div className="crm-section-subtitle">
        Add a lead from referrals, calls, web forms, or direct outreach.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <input placeholder="IG handle (optional)" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} />
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <input placeholder="Intent" value={intent} onChange={(e) => setIntent(e.target.value)} />
        <input placeholder="Timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
        <input placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
        <select value={leadTemp} onChange={(e) => setLeadTemp(e.target.value)}>
          <option value="Cold">Cold</option>
          <option value="Warm">Warm</option>
          <option value="Hot">Hot</option>
        </select>
      </div>

      <div className="crm-inline-actions">
        <button onClick={() => void saveLead()} disabled={saving} className="crm-btn crm-btn-primary">
          {saving ? "Saving..." : "Add Lead"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="crm-btn crm-btn-secondary">
            Close
          </button>
        ) : null}
      </div>

      {message ? (
        <div className={`crm-chip ${message.includes("Could") || message.includes("required") ? "crm-chip-danger" : "crm-chip-ok"}`} style={{ marginTop: 10, width: "fit-content" }}>
          {message}
        </div>
      ) : null}
    </section>
  );
}
