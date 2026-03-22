"use client";

import { useState } from "react";

type AlertRow = {
  id: string;
  title: string;
  message: string;
  severity: string;
  created_at: string;
};

function formatTimeAgo(value: string | null): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FormAlertsSection({ initialAlerts }: { initialAlerts: AlertRow[] }) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);

  if (alerts.length === 0) return null;

  async function dismiss(id: string) {
    try {
      await fetch(`/api/secretary/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
    } catch {
      // best-effort — remove from UI regardless
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <section className="crm-card crm-section-card crm-stack-8">
      <div className="crm-section-head">
        <div>
          <h2 className="crm-section-title">New Form Submissions</h2>
        </div>
      </div>
      <div className="crm-stack-6">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="crm-card-muted"
            style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{alert.title}</div>
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{alert.message}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{formatTimeAgo(alert.created_at)}</span>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => void dismiss(alert.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
