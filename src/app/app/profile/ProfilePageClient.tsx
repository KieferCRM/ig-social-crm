"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  slug: string;
  isPublic: boolean;
  hasContent: boolean;
};

export default function ProfilePageClient({ slug, isPublic, hasContent }: Props) {
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

  if (!hasContent) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px 80px" }}>
        <div style={{
          borderRadius: 20,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "48px 40px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>👋</div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-muted)", marginBottom: 12 }}>
            LockboxHQ · Personal Website Developer
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            Let&apos;s build your public page
          </h1>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: "var(--ink-muted)", lineHeight: 1.7, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            I&apos;ll ask you 7 quick questions about your business. From your answers, I&apos;ll write your bio, outline your process, set your color palette, and publish your page — all in about 2 minutes.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "0 auto 36px", textAlign: "left" }}>
            {[
              "Company name & tagline",
              "Markets you work in",
              "Your process (how it works)",
              "Stats you're proud of",
              "Your story / bio",
              "Brand vibe & color palette",
            ].map((item, i) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "var(--surface-strong, #f1f5f9)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "var(--ink-muted)",
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{item}</span>
              </div>
            ))}
          </div>

          <Link
            href="/app/profile/onboard"
            className="crm-btn crm-btn-primary"
            style={{ fontSize: 15, padding: "14px 36px", textDecoration: "none", fontWeight: 700, display: "inline-block" }}
          >
            Let&apos;s build it →
          </Link>
          <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--ink-faint)" }}>
            Takes about 2 minutes · You can edit anything after
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px 80px" }}>

      {/* Status banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 12,
        background: pub ? "var(--ok-bg, #f0fdf4)" : "var(--surface-strong, #f8fafc)",
        border: `1px solid ${pub ? "var(--ok-border, #bbf7d0)" : "var(--border, #e2e8f0)"}`,
        marginBottom: 32,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: pub ? "var(--ok, #16a34a)" : "var(--ink-faint, #94a3b8)",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: pub ? "var(--ok, #16a34a)" : "var(--ink-muted)" }}>
            {pub ? "Live — visible to the public" : "Hidden — only you can see it"}
          </span>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          style={{ fontSize: 12, padding: "4px 12px" }}
          onClick={() => void togglePublic()}
          disabled={toggling}
        >
          {toggling ? "..." : pub ? "Take offline" : "Make public"}
        </button>
      </div>

      {/* URL row */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>
          Your page URL
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{
            flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--surface-strong)",
            color: "var(--ink)", wordBreak: "break-all",
          }}>
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

      {/* Main CTA */}
      <div style={{
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "36px 32px",
        textAlign: "center",
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>✨</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {hasContent ? "Rebuild with AI" : "Build your page with AI"}
        </h2>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.65, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
          {hasContent
            ? "Answer a few questions and we'll regenerate your public page with fresh copy, your stats, and your brand palette."
            : "Answer 7 quick questions. We'll write your bio, process steps, and pick a color palette — then publish it instantly."}
        </p>
        <Link
          href="/app/profile/onboard"
          className="crm-btn crm-btn-primary"
          style={{ fontSize: 15, padding: "13px 32px", textDecoration: "none", fontWeight: 700 }}
        >
          {hasContent ? "Rebuild with AI →" : "Build with AI →"}
        </Link>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-faint)", margin: 0 }}>
        Takes about 2 minutes · Your answers become polished marketing copy
      </p>
    </div>
  );
}
