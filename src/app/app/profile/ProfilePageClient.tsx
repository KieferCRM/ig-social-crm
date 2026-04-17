"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  slug: string;
  isPublic: boolean;
};

export default function ProfilePageClient({ slug, isPublic }: Props) {
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : "https://lockboxhq.com"}/p/${slug}`;
  const [copied, setCopied] = useState(false);
  const [pub, setPub] = useState(isPublic);
  const [toggling, setToggling] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function togglePublic() {
    setToggling(true);
    try {
      await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_public: !pub }),
      });
      setPub((v) => !v);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px 80px" }}>

      {/* Status banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "14px 18px", borderRadius: 12, marginBottom: 32,
        background: pub ? "var(--ok-bg, #f0fdf4)" : "var(--surface-strong, #f8fafc)",
        border: `1px solid ${pub ? "var(--ok-border, #bbf7d0)" : "var(--border, #e2e8f0)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: pub ? "var(--ok, #16a34a)" : "var(--ink-faint, #94a3b8)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: pub ? "var(--ok, #16a34a)" : "var(--ink-muted)" }}>
            {pub ? "Live — visible to the public" : "Hidden — only you can see it"}
          </span>
        </div>
        <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => void togglePublic()} disabled={toggling}>
          {toggling ? "..." : pub ? "Take offline" : "Make public"}
        </button>
      </div>

      {/* URL row */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>Your page URL</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--ink)", wordBreak: "break-all" }}>
            {publicUrl}
          </code>
          <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={() => void handleCopy()}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, whiteSpace: "nowrap", textDecoration: "none" }}>
            Preview →
          </a>
        </div>
      </div>

      {/* Rebuild CTA */}
      <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>✨</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>Rebuild with AI</h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.65, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
          Answer a few questions and we&apos;ll regenerate your page with fresh copy, your stats, and a new palette.
        </p>
        <Link href="/app/profile/onboard" className="crm-btn crm-btn-primary" style={{ fontSize: 14, padding: "12px 28px", textDecoration: "none", fontWeight: 700 }}>
          Rebuild with AI →
        </Link>
      </div>
    </div>
  );
}
