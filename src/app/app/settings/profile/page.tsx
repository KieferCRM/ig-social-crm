"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text }: { text: string }) {
  const [msg, setMsg] = useState("");
  async function handle() {
    const ok = await copyText(text);
    setMsg(ok ? "Copied!" : "Failed");
    window.setTimeout(() => setMsg(""), 1800);
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => void handle()}>
        Copy link
      </button>
      {msg ? <span style={{ fontSize: 12, color: "var(--ok, #16a34a)", fontWeight: 600 }}>{msg}</span> : null}
    </span>
  );
}

function ShareButton({ text }: { text: string }) {
  const [msg, setMsg] = useState("");
  async function handle() {
    const ok = await copyText(text);
    setMsg(ok ? "Copied!" : "Failed");
    window.setTimeout(() => setMsg(""), 1800);
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => void handle()}>
        Copy share message
      </button>
      {msg ? <span style={{ fontSize: 12, color: "var(--ok, #16a34a)", fontWeight: 600 }}>{msg}</span> : null}
    </span>
  );
}

export default function ProfileSettingsPage() {
  const supabase = supabaseBrowser();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [checkError, setCheckError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAgentId(user.id);
      const { data } = await supabase.from("agents").select("vanity_slug").eq("id", user.id).maybeSingle();
      const s = (data?.vanity_slug as string | null) ?? null;
      setCurrentSlug(s);
      setSlug(s ?? "");
      setLoading(false);
    }
    void load();
  }, [supabase]);

  // Live availability check
  useEffect(() => {
    const s = normalize(slug);
    if (!s) { setCheckState("idle"); return; }

    if (s === currentSlug) {
      setCheckState("available");
      setCheckError("");
      return;
    }

    if (!SLUG_RE.test(s)) {
      setCheckState("invalid");
      setCheckError(
        s.length < 3 ? "At least 3 characters required." :
        s.length > 30 ? "Max 30 characters." :
        "Only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen."
      );
      return;
    }

    setCheckState("checking");
    setCheckError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agent/slug?slug=${encodeURIComponent(s)}`);
        const data = (await res.json()) as { available: boolean; error?: string };
        if (data.error) { setCheckState("invalid"); setCheckError(data.error); }
        else setCheckState(data.available ? "available" : "taken");
      } catch { setCheckState("idle"); }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slug, currentSlug]);

  async function handleSave() {
    const s = normalize(slug);
    if (!s || checkState !== "available") return;
    setSaving(true);
    setSaveMsg("");

    const res = await fetch("/api/agent/slug", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: s }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; slug?: string };
    setSaving(false);

    if (!res.ok || !data.ok) {
      setSaveMsg(data.error ?? "Could not save slug.");
    } else {
      setCurrentSlug(data.slug ?? s);
      setSlug(data.slug ?? s);
      setSaveMsg("Slug updated!");
      window.setTimeout(() => setSaveMsg(""), 3000);
    }
  }

  const displaySlug = currentSlug ?? agentId ?? "";
  const sellerUrl = displaySlug ? `https://lockboxhq.com/forms/seller/${displaySlug}` : "";
  const contactUrl = displaySlug ? `https://lockboxhq.com/forms/buyer/${displaySlug}` : "";
  const sellerShareMsg = sellerUrl ? `Submit your property info here: ${sellerUrl}` : "";
  const contactShareMsg = contactUrl ? `Fill out your info here: ${contactUrl}` : "";

  const statusColor =
    checkState === "available" ? "var(--ok, #16a34a)" :
    checkState === "taken" || checkState === "invalid" ? "var(--danger, #dc2626)" :
    "var(--ink-muted)";

  const statusText =
    checkState === "checking" ? "Checking..." :
    checkState === "available" ? (normalize(slug) === currentSlug ? "This is your current slug." : "✓ Available") :
    checkState === "taken" ? "✗ Already taken — try a different slug" :
    checkState === "invalid" ? `✗ ${checkError}` : "";

  const canSave = checkState === "available" && normalize(slug) !== currentSlug && !saving;

  if (loading) {
    return <main className="crm-page crm-stack-12" style={{ maxWidth: 700 }}><div style={{ color: "var(--ink-muted)", padding: 32 }}>Loading...</div></main>;
  }

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 700 }}>
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Profile & Form URL</h1>
            <p className="crm-page-subtitle">
              Manage your branded form slug and share your seller and contact form links.
            </p>
          </div>
        </div>
      </section>

      {/* Your form URLs */}
      <section className="crm-card crm-section-card crm-stack-10">
        <h2 className="crm-section-title">Your form links</h2>

        {!currentSlug ? (
          <div style={{ fontSize: 14, color: "var(--ink-muted)", background: "var(--surface-2, #f8fafc)", padding: 12, borderRadius: 8 }}>
            Set a slug below to get your branded form links.
          </div>
        ) : (
          <div className="crm-stack-8">
            {/* Seller form */}
            <div style={{ background: "var(--surface-2, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: "12px 14px" }}>
              <div className="crm-detail-label" style={{ marginBottom: 6 }}>Seller form</div>
              <code style={{ display: "block", fontSize: 13, marginBottom: 10, wordBreak: "break-all" }}>{sellerUrl}</code>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <CopyButton text={sellerUrl} />
                <ShareButton text={sellerShareMsg} />
              </div>
            </div>

            {/* Contact form */}
            <div style={{ background: "var(--surface-2, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: "12px 14px" }}>
              <div className="crm-detail-label" style={{ marginBottom: 6 }}>Contact form</div>
              <code style={{ display: "block", fontSize: 13, marginBottom: 10, wordBreak: "break-all" }}>{contactUrl}</code>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <CopyButton text={contactUrl} />
                <ShareButton text={contactShareMsg} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Change slug */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div>
          <h2 className="crm-section-title">{currentSlug ? "Change your slug" : "Set your slug"}</h2>
          <p className="crm-section-subtitle">
            Your slug appears in every form link you share. 3–30 characters, lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        {currentSlug && (
          <div style={{ fontSize: 13, color: "var(--ink-muted)", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px" }}>
            Changing your slug creates an automatic redirect from your old URL — but update any printed or saved links when you can.
          </div>
        )}

        <div>
          <input
            className="crm-input"
            type="text"
            value={slug}
            placeholder="e.g. jane-smith-realty"
            maxLength={30}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            autoComplete="off"
            spellCheck={false}
          />
          {statusText ? (
            <div style={{ marginTop: 6, fontSize: 13, color: statusColor, fontWeight: 500 }}>{statusText}</div>
          ) : null}
        </div>

        {saveMsg ? (
          <div style={{ fontSize: 13, color: saveMsg === "Slug updated!" ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)", fontWeight: 600 }}>
            {saveMsg}
          </div>
        ) : null}

        <div>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : currentSlug ? "Update slug" : "Set slug"}
          </button>
        </div>
      </section>
    </main>
  );
}
