"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CreateLeadResponse = {
  lead?: { id: string; ig_username: string };
  error?: string;
};

export default function QuickAddLead() {
  const router = useRouter();
  const [leadLabel, setLeadLabel] = useState("");
  const [leadTemp, setLeadTemp] = useState("Warm");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveLead() {
    const handle = leadLabel.trim();
    if (!handle) {
      setMessage("Lead name or handle is required.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/leads/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ig_username: handle,
          lead_temp: leadTemp,
          source: "manual",
          stage: "New",
        }),
      });
      const data = (await response.json()) as CreateLeadResponse;
      if (!response.ok || !data.lead) {
        setMessage(data.error || "Could not save lead.");
        return;
      }
      setMessage(`Saved ${data.lead.ig_username}`);
      setLeadLabel("");
      router.refresh();
    } catch {
      setMessage("Could not save lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="quick-add-lead" className="crm-card crm-quick-add-card">
      <div className="crm-quick-add-title">Quick Add Lead</div>
      <div className="crm-quick-add-grid">
        <input
          placeholder="Lead name or handle"
          value={leadLabel}
          onChange={(e) => setLeadLabel(e.target.value)}
        />
        <select value={leadTemp} onChange={(e) => setLeadTemp(e.target.value)}>
          <option value="Cold">Cold</option>
          <option value="Warm">Warm</option>
          <option value="Hot">Hot</option>
        </select>
        <button onClick={() => void saveLead()} disabled={saving} className="crm-btn crm-btn-primary">
          {saving ? "Saving..." : "Add"}
        </button>
      </div>
      {message ? (
        <div
          className={`crm-chip ${message.includes("Could") || message.includes("required") ? "crm-chip-danger" : "crm-chip-ok"}`}
          style={{ marginTop: 10, width: "fit-content" }}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
