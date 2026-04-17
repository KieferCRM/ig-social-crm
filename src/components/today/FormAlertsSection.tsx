"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function FormAlertsSection({
  initialAlerts,
  title = "New Form Submissions",
}: {
  initialAlerts: AlertRow[];
  title?: string;
}) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);

  // Poll every 30s so the Today page picks up new submissions without a full refresh
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(
          "/api/secretary/alerts?status=open&type=form_submission,call_inbound",
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { alerts?: AlertRow[] };
        if (data.alerts) setAlerts(data.alerts);
      } catch { /* ignore */ }
    }

    const timer = setInterval(() => void poll(), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (alerts.length === 0) return null;

  async function dismiss(id: string) {
    try {
      await fetch(`/api/secretary/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
    } catch { /* best-effort */ }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <section className="crm-card crm-section-card crm-stack-8">
      <div className="crm-section-head">
        <h2 className="crm-section-title">{title}</h2>
        <Link href="/app/intake" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }}>
          Open Intake →
        </Link>
      </div>
      <div className="crm-stack-6">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="crm-card-muted"
            style={{
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
              borderLeft: "3px solid var(--danger, #dc2626)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{alert.title}</div>
              <div style={{ color: "var(--ink-muted)", fontSize: 13, lineHeight: 1.4 }}>{alert.message}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Link
                  href="/app/intake"
                  className="crm-btn crm-btn-primary"
                  style={{ fontSize: 12, padding: "4px 12px", textDecoration: "none" }}
                >
                  Review in Intake →
                </Link>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                {formatTimeAgo(alert.created_at)}
              </span>
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
