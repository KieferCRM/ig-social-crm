"use client";

import { useState } from "react";
import { TIMEFRAME_OPTIONS, sourceChannelLabel, type SourceChannel } from "@/lib/inbound";
import type { LeadListRow } from "./lead-list-table";

type CreateLeadResponse = {
  lead?: LeadListRow;
  error?: string;
};

const SOURCE_OPTIONS: SourceChannel[] = [
  "manual",
  "instagram",
  "facebook",
  "tiktok",
  "website_form",
  "open_house",
  "concierge",
  "referral",
  "other",
];

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
  const [igUsername, setIgUsername] = useState("");
  const [intent, setIntent] = useState("Buy");
  const [timeline, setTimeline] = useState<(typeof TIMEFRAME_OPTIONS)[number]>(TIMEFRAME_OPTIONS[0]);
  const [source, setSource] = useState<SourceChannel>("manual");
  const [budgetRange, setBudgetRange] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [contactPreference, setContactPreference] = useState("Text");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
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
          intent: intent || null,
          timeline,
          source,
          budget_range: budgetRange.trim() || null,
          location_area: locationArea.trim() || null,
          contact_preference: contactPreference || null,
          tags: tags.trim() || null,
          notes: notes.trim() || null,
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
      setIgUsername("");
      setIntent("Buy");
      setTimeline(TIMEFRAME_OPTIONS[0]);
      setSource("manual");
      setBudgetRange("");
      setLocationArea("");
      setContactPreference("Text");
      setTags("");
      setNotes("");
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
        <h2 className="crm-section-title">Add lead manually</h2>
      </div>
      <div className="crm-section-subtitle">
        Use this for referrals, direct calls, walk-ins, or any inquiry that needs to enter the same intake
        workflow by hand.
      </div>

      <div className="crm-manual-lead-grid">
        <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input placeholder="Social handle (optional)" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} />

        <select value={intent} onChange={(e) => setIntent(e.target.value)}>
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
          <option value="Rent">Rent</option>
          <option value="Invest">Invest</option>
          <option value="Not sure">Not sure</option>
        </select>

        <select value={timeline} onChange={(e) => setTimeline(e.target.value as (typeof TIMEFRAME_OPTIONS)[number])}>
          {TIMEFRAME_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select value={source} onChange={(e) => setSource(e.target.value as SourceChannel)}>
          {SOURCE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {sourceChannelLabel(option)}
            </option>
          ))}
        </select>

        <select value={contactPreference} onChange={(e) => setContactPreference(e.target.value)}>
          <option value="Text">Text</option>
          <option value="Call">Call</option>
          <option value="Email">Email</option>
        </select>

        <input
          placeholder="Budget or price range"
          value={budgetRange}
          onChange={(e) => setBudgetRange(e.target.value)}
        />
        <input
          placeholder="Area, neighborhood, or property"
          value={locationArea}
          onChange={(e) => setLocationArea(e.target.value)}
        />
        <input
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      <textarea
        placeholder="Notes or context"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
      />

      <div className="crm-inline-actions">
        <button onClick={() => void saveLead()} disabled={saving} className="crm-btn crm-btn-primary">
          {saving ? "Saving..." : "Add lead"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="crm-btn crm-btn-secondary">
            Close
          </button>
        ) : null}
      </div>

      {message ? (
        <div
          className={`crm-chip ${message.includes("Could") || message.includes("identity field") ? "crm-chip-danger" : "crm-chip-ok"}`}
          style={{ marginTop: 10, width: "fit-content" }}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
