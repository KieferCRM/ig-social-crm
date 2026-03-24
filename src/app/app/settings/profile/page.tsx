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
  const [timezone, setTimezone] = useState("America/New_York");
  const [savingTz, setSavingTz] = useState(false);
  const [tzMsg, setTzMsg] = useState("");
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAgentId(user.id);
      const { data } = await supabase.from("agents").select("vanity_slug, timezone, full_name").eq("id", user.id).maybeSingle();
      const s = (data?.vanity_slug as string | null) ?? null;
      setCurrentSlug(s);
      setSlug(s ?? "");
      if (data?.timezone) setTimezone(data.timezone as string);
      if (data?.full_name) setFullName(data.full_name as string);
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

  async function handleSaveName() {
    if (!agentId) return;
    setSavingName(true);
    setNameMsg("");
    const { error } = await supabase.from("agents").update({ full_name: fullName.trim() }).eq("id", agentId);
    setSavingName(false);
    if (error) {
      setNameMsg("Could not save name.");
    } else {
      setNameMsg("Name saved.");
      window.setTimeout(() => setNameMsg(""), 3000);
    }
  }

  async function handleSaveTimezone() {
    if (!agentId) return;
    setSavingTz(true);
    setTzMsg("");
    const { error } = await supabase.from("agents").update({ timezone }).eq("id", agentId);
    setSavingTz(false);
    if (error) {
      setTzMsg("Could not save timezone.");
    } else {
      setTzMsg("Timezone saved.");
      window.setTimeout(() => setTzMsg(""), 3000);
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

      {/* Your name */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div>
          <h2 className="crm-section-title">Your Name</h2>
          <p className="crm-section-subtitle">
            Used by your AI receptionist on calls — callers will hear this name.
          </p>
        </div>
        <input
          className="crm-input"
          type="text"
          value={fullName}
          placeholder="e.g. Alex Johnson"
          onChange={(e) => setFullName(e.target.value)}
        />
        {nameMsg ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: nameMsg === "Name saved." ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)" }}>
            {nameMsg}
          </div>
        ) : null}
        <div>
          <button type="button" className="crm-btn crm-btn-primary" disabled={savingName} onClick={() => void handleSaveName()}>
            {savingName ? "Saving..." : "Save name"}
          </button>
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

      {/* Timezone */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div>
          <h2 className="crm-section-title">Timezone</h2>
          <p className="crm-section-subtitle">
            Used for "due today" and follow-up date logic. Set this to your local timezone.
          </p>
        </div>
        <label className="crm-filter-field">
          <span>Your timezone</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <optgroup label="United States">
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Phoenix">Mountain Time – Arizona (no DST)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Anchorage">Alaska Time (AKT)</option>
              <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
            </optgroup>
            <optgroup label="Canada">
              <option value="America/Toronto">Eastern – Toronto</option>
              <option value="America/Vancouver">Pacific – Vancouver</option>
              <option value="America/Edmonton">Mountain – Edmonton</option>
              <option value="America/Winnipeg">Central – Winnipeg</option>
              <option value="America/Halifax">Atlantic – Halifax</option>
            </optgroup>
          </select>
        </label>
        {tzMsg ? (
          <div style={{ fontSize: 13, color: tzMsg === "Timezone saved." ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)", fontWeight: 600 }}>
            {tzMsg}
          </div>
        ) : null}
        <div>
          <button type="button" className="crm-btn crm-btn-primary" disabled={savingTz} onClick={() => void handleSaveTimezone()}>
            {savingTz ? "Saving..." : "Save timezone"}
          </button>
        </div>
      </section>

      {/* Contact / Support */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div>
          <h2 className="crm-section-title">Contact & Support</h2>
          <p className="crm-section-subtitle">
            Questions, feedback, or issues? Reach out directly.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <span style={{ color: "var(--ink-muted)" }}>Email:</span>
          <a href="mailto:lockboxhq1@gmail.com" style={{ color: "var(--ink-primary)", fontWeight: 600, textDecoration: "none" }}>
            lockboxhq1@gmail.com
          </a>
        </div>
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

      {/* Danger zone */}
      <section className="crm-card crm-section-card crm-stack-10" style={{ border: "1px solid #fca5a5" }}>
        <div>
          <h2 className="crm-section-title" style={{ color: "#dc2626" }}>Danger zone</h2>
          <p className="crm-section-subtitle">
            Remove all sample data that was added during workspace setup. Your real leads, deals, and contacts are not affected.
          </p>
        </div>
        <ClearSampleDataButton />
      </section>
    </main>
  );
}

function ClearSampleDataButton() {
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleClear() {
    if (!window.confirm("Remove all sample data from your workspace? This cannot be undone.")) return;
    setClearing(true);
    setMsg("");
    try {
      const res = await fetch("/api/onboarding/sample-workspace", { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; removed?: number; error?: string };
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? "Could not clear sample data.");
      } else {
        setMsg(`Done — ${data.removed ?? 0} sample records removed.`);
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="crm-stack-8">
      <button
        type="button"
        className="crm-btn"
        disabled={clearing}
        onClick={() => void handleClear()}
        style={{ background: "#dc2626", color: "#fff", border: "none" }}
      >
        {clearing ? "Clearing..." : "Clear sample data"}
      </button>
      {msg && (
        <div style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith("Done") ? "var(--ok, #16a34a)" : "#dc2626" }}>
          {msg}
        </div>
      )}
    </div>
  );
}
