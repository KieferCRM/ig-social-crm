"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ChecklistData = {
  hasSlug: boolean;
  hasContact: boolean;
  hasDeal: boolean;
  hasPhone: boolean;
};

const DISMISS_KEY = "welcome_checklist_dismissed";

export default function WelcomeChecklist() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }
    void fetch("/api/checklist")
      .then((r) => r.json())
      .then((d) => setData(d as ChecklistData))
      .catch(() => { /* ignore */ });
  }, []);

  if (dismissed || !data) return null;

  const items = [
    { done: data.hasContact, label: "Add your first contact", href: "/app/contacts?add=true", action: "Add contact" },
    { done: data.hasDeal, label: "Add your first deal", href: "/app/pipeline", action: "Open pipeline" },
    { done: data.hasSlug, label: "Set your profile slug", href: "/app/settings/profile", action: "Set slug" },
    { done: data.hasPhone, label: "Connect your phone (for Secretary SMS)", href: "/app/settings/receptionist", action: "Go to settings" },
  ];

  const completed = items.filter((i) => i.done).length;
  const allDone = completed === items.length;

  // Don't show if everything is done (dismiss automatically)
  if (allDone) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <section className="crm-card crm-section-card crm-stack-10" style={{ borderLeft: "4px solid var(--ink-primary, #0ea5e9)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 className="crm-section-title" style={{ marginBottom: 2 }}>Get started</h2>
          <p className="crm-section-subtitle" style={{ marginBottom: 0 }}>
            {completed} of {items.length} setup steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--ink-muted)", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}
          aria-label="Dismiss checklist"
        >
          ×
        </button>
      </div>

      <div className="crm-stack-6">
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: item.done ? "none" : "2px solid var(--border, #e2e8f0)",
              background: item.done ? "var(--ok, #16a34a)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 11,
              color: "#fff",
              fontWeight: 700,
            }}>
              {item.done ? "✓" : ""}
            </span>
            <span style={{ fontSize: 14, color: item.done ? "var(--ink-muted)" : "var(--ink)", textDecoration: item.done ? "line-through" : "none", flex: 1 }}>
              {item.label}
            </span>
            {!item.done && (
              <Link href={item.href} className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "3px 10px", flexShrink: 0 }}>
                {item.action}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
