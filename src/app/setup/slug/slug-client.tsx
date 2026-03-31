"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LockboxMark from "@/components/branding/lockbox-mark";
import { getOnboardingStepKicker } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-telemetry";

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default function SlugClient({ suggestedSlug }: { suggestedSlug: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(suggestedSlug);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [checkError, setCheckError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [skipping, setSkipping] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void recordOnboardingEvent({
      event_name: "step_view",
      step: "slug",
      surface: "setup/slug",
    });
  }, []);

  // Live availability check
  useEffect(() => {
    const s = normalize(slug);
    if (!s) { setCheckState("idle"); return; }

    if (!SLUG_RE.test(s)) {
      setCheckState("invalid");
      setCheckError(
        s.length < 3
          ? "At least 3 characters required."
          : s.length > 30
          ? "Max 30 characters."
          : "Only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen."
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
        if (data.error) {
          setCheckState("invalid");
          setCheckError(data.error);
        } else {
          setCheckState(data.available ? "available" : "taken");
        }
      } catch {
        setCheckState("idle");
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slug]);

  async function handleSave() {
    const s = normalize(slug);
    if (!s || checkState !== "available") return;
    setSaving(true);
    setSaveError("");

    try {
      const slugRes = await fetch("/api/agent/slug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: s }),
      });
      const slugData = (await slugRes.json()) as { ok?: boolean; error?: string };
      if (!slugRes.ok || !slugData.ok) {
        setSaveError(slugData.error ?? "Could not save slug.");
        setSaving(false);
        return;
      }

      void recordOnboardingEvent({
        event_name: "step_complete",
        step: "slug",
        status: "saved",
        surface: "setup/slug",
      });

      router.replace("/setup/social");
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    void recordOnboardingEvent({
      event_name: "step_complete",
      step: "slug",
      status: "skipped",
      surface: "setup/slug",
    });
    router.replace("/setup/social");
  }

  const previewSlug = normalize(slug) || "your-slug";
  const previewUrl = `lockboxhq.com/forms/seller/${previewSlug}`;
  const previewInbox = `${previewSlug}@drop.lockboxhq.com`;

  const statusColor =
    checkState === "available" ? "var(--ok, #16a34a)" :
    checkState === "taken" || checkState === "invalid" ? "var(--danger, #dc2626)" :
    "var(--ink-muted)";

  const statusText =
    checkState === "checking" ? "Checking..." :
    checkState === "available" ? "✓ Available" :
    checkState === "taken" ? "✗ Already taken — try a different slug" :
    checkState === "invalid" ? `✗ ${checkError}` :
    "";

  const canSave = checkState === "available" && !saving;

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">{getOnboardingStepKicker("slug")}</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">Choose your slug</h1>
            <p className="crm-auth-subtitle">
              This powers two things: your public intake form link, and your personal LockboxHQ inbox address where you can forward documents, transcripts, and deals.
            </p>
          </div>

          <div className="crm-stack-10">
            {/* Dual preview */}
            <div
              style={{
                background: "var(--surface-2, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Form link
                </div>
                <code style={{ fontSize: 13, color: "var(--foreground)", wordBreak: "break-all" }}>
                  {previewUrl}
                </code>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Your inbox address
                </div>
                <code style={{ fontSize: 13, color: "var(--foreground)", wordBreak: "break-all" }}>
                  {previewInbox}
                </code>
                <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>
                  Forward call transcripts, signed contracts, and new deals here — Lockbox processes them automatically.
                </div>
              </div>
            </div>

            {/* Slug input */}
            <div>
              <label className="crm-public-intake-field crm-public-intake-field-full">
                <span style={{ fontWeight: 600 }}>
                  Your custom URL <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </span>
                <input
                  className="crm-input"
                  type="text"
                  value={slug}
                  placeholder="e.g. jane-smith-realty"
                  maxLength={30}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              {statusText ? (
                <div style={{ marginTop: 6, fontSize: 13, color: statusColor, fontWeight: 500 }}>
                  {statusText}
                </div>
              ) : null}
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-faint)" }}>
                3–30 characters. Lowercase letters, numbers, and hyphens only.
              </div>
            </div>

            {saveError ? (
              <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{saveError}</div>
            ) : null}

            <div className="crm-inline-actions" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => void handleSkip()}
                disabled={skipping || saving}
                style={{ fontSize: 13 }}
              >
                {skipping ? "Skipping..." : "Skip for now"}
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void handleSave()}
                disabled={!canSave}
              >
                {saving ? "Saving..." : "Set my slug"}
              </button>
            </div>
          </div>
        </section>

        <aside className="crm-card crm-auth-trust-panel">
          <div className="crm-auth-panel-kicker">Why this matters</div>
          <h2 className="crm-auth-panel-title">Your slug is the brain of your CRM.</h2>
          <p className="crm-auth-panel-body">
            It powers your intake form link AND your private inbox address. Anything forwarded to your inbox — call transcripts, signed contracts, new referrals — gets processed automatically and logged to the right deal.
          </p>
          <div className="crm-auth-value-list">
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Forward Plaud transcripts here — Lockbox logs them to the right deal</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Email signed contracts to your inbox — stored to Documents automatically</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>BCC your inbox on any email you send — Lockbox logs it as a note</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>You can change your slug later in Settings</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
