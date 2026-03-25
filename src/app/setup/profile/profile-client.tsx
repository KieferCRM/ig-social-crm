"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LockboxMark from "@/components/branding/lockbox-mark";

type Props = {
  initialFullName: string;
  initialBrokerage: string;
  initialPhone: string;
};

export default function ProfileClient({ initialFullName, initialBrokerage, initialPhone }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [brokerage, setBrokerage] = useState(initialBrokerage);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    if (!fullName.trim()) {
      setError("Your name is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          brokerage: brokerage.trim(),
          business_phone: phone.trim(),
          timezone: detectedTimezone,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save profile.");
        setSaving(false);
        return;
      }
      router.replace("/setup/slug");
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function handleSkip() {
    // Save timezone even on skip so date calculations use local time
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: detectedTimezone }),
      });
    } catch { /* non-critical */ }
    router.replace("/setup/slug");
  }

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">Step 2 of 6 — Your profile</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">Tell us about yourself</h1>
            <p className="crm-auth-subtitle">
              This info personalizes your CRM, your AI receptionist, and your public profile.
            </p>
          </div>

          <div className="crm-stack-10">
            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>
                Your name <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
              </span>
              <input
                className="crm-input"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                autoComplete="name"
              />
            </label>

            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>Brokerage / company</span>
              <input
                className="crm-input"
                type="text"
                placeholder="Smith Realty Group"
                value={brokerage}
                onChange={(e) => setBrokerage(e.target.value)}
                autoComplete="organization"
              />
            </label>

            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>Business phone number</span>
              <input
                className="crm-input"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                The number clients call — your AI receptionist answers this line.
              </span>
            </label>

            {error ? (
              <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div>
            ) : null}

            <div className="crm-inline-actions" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => void handleSkip()}
                disabled={saving}
                style={{ fontSize: 13 }}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void handleContinue()}
                disabled={saving}
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </section>

        <aside className="crm-card crm-auth-trust-panel">
          <div className="crm-auth-panel-kicker">Why this matters</div>
          <h2 className="crm-auth-panel-title">Your AI receptionist needs to know your name.</h2>
          <p className="crm-auth-panel-body">
            When someone calls your business number, your AI receptionist introduces itself as
            your assistant and mentions you by name. Without this, callers hear a generic greeting.
          </p>
          <div className="crm-auth-value-list">
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Your name appears in the AI greeting on every call</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Brokerage name shows on your public profile and forms</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Business phone links your number to your AI receptionist</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
