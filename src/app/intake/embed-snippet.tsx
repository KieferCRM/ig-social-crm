"use client";

import { useMemo, useState } from "react";

export default function EmbedSnippet() {
  const [message, setMessage] = useState("");

  const intakeUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://YOUR-DOMAIN.com/intake?source=website_embed";
    return `${window.location.origin}/intake?source=website_embed`;
  }, []);

  const buttonSnippet = `<a href="${intakeUrl}" target="_blank" rel="noopener">Start Property Intake</a>`;
  const iframeSnippet = `<iframe src="${intakeUrl}" style="width:100%;max-width:760px;height:900px;border:0;border-radius:12px;" loading="lazy"></iframe>`;

  async function copySnippet(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  return (
    <section className="crm-card" style={{ marginTop: 14, padding: 16 }}>
      <h2 style={{ margin: 0 }}>Embed Snippet</h2>
      <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
        Drop these snippets into your website or link-in-bio pages to capture leads without Meta API access.
      </p>
      <div className="crm-card-muted" style={{ marginTop: 8, padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
        <strong style={{ color: "var(--foreground)" }}>Difference:</strong> Link snippet opens the intake form on its own page.
        Iframe snippet shows the intake form directly inside your page.
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div className="crm-card-muted" style={{ padding: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Option A: Link button (Recommended)</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
            Best for bio links, social profiles, and quick website CTAs.
          </div>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 12 }}>{buttonSnippet}</pre>
          <button className="crm-btn crm-btn-secondary" style={{ marginTop: 8, padding: "6px 9px", fontSize: 12 }} onClick={() => void copySnippet(buttonSnippet, "Button snippet")}>
            Copy Button Snippet
          </button>
        </div>

        <div className="crm-card-muted" style={{ padding: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Option B: Inline form (iframe)</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
            Best when you want the full intake form displayed directly on your site page.
          </div>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 12 }}>{iframeSnippet}</pre>
          <button className="crm-btn crm-btn-secondary" style={{ marginTop: 8, padding: "6px 9px", fontSize: 12 }} onClick={() => void copySnippet(iframeSnippet, "Iframe snippet")}>
            Copy Iframe Snippet
          </button>
        </div>
      </div>

      {message ? (
        <div style={{ marginTop: 10 }} className={`crm-chip ${message.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`}>
          {message}
        </div>
      ) : null}
    </section>
  );
}
