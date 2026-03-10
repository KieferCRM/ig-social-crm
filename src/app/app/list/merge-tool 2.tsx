"use client";

import { useState } from "react";

type LeadOption = {
  id: string;
  ig_username: string | null;
};

export default function MergeTool({ leads }: { leads: LeadOption[] }) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function merge() {
    if (!sourceId || !targetId || sourceId === targetId) {
      setMessage("Choose different source and target leads.");
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
      setMessage("Lead merge complete. Refreshing...");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setMessage("Merge failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 14,
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        background: "#fff",
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 700 }}>Identity Merge Tool</div>
      <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
        Merge duplicate contacts into one record. Reminders from source move to target.
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ padding: 8 }}>
          <option value="">Source lead (will be removed)</option>
          {leads.map((lead) => (
            <option key={`source-${lead.id}`} value={lead.id}>
              @{lead.ig_username || "unknown"}
            </option>
          ))}
        </select>

        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ padding: 8 }}>
          <option value="">Target lead (kept)</option>
          {leads.map((lead) => (
            <option key={`target-${lead.id}`} value={lead.id}>
              @{lead.ig_username || "unknown"}
            </option>
          ))}
        </select>

        <button
          onClick={() => void merge()}
          disabled={working}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fff",
            padding: "8px 10px",
            fontWeight: 700,
            cursor: working ? "not-allowed" : "pointer",
          }}
        >
          {working ? "Merging..." : "Merge"}
        </button>
      </div>

      {message ? (
        <div style={{ marginTop: 8, fontSize: 13, color: message.includes("failed") ? "#b00020" : "#186a3b" }}>
          {message}
        </div>
      ) : null}
    </section>
  );
}
