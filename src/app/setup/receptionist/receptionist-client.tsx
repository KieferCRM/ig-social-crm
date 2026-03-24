"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LockboxMark from "@/components/branding/lockbox-mark";
import type { VoicePreset } from "@/lib/receptionist/settings";

type Props = {
  initialPreset: VoicePreset;
  initialVoiceName: string;
};

type VoiceOption = {
  value: VoicePreset;
  label: string;
  description: string;
  defaultName: string;
};

const VOICE_OPTIONS: VoiceOption[] = [
  {
    value: "female",
    label: "Female voice",
    description: "Professional female AI receptionist, ready immediately.",
    defaultName: "Natalee",
  },
  {
    value: "male",
    label: "Male voice",
    description: "Professional male AI receptionist, ready immediately.",
    defaultName: "Jake",
  },
  {
    value: "custom",
    label: "My voice",
    description: "Clone your own voice. You'll record and upload a sample after setup.",
    defaultName: "",
  },
];

export default function ReceptionistClient({ initialPreset, initialVoiceName }: Props) {
  const router = useRouter();
  const [preset, setPreset] = useState<VoicePreset>(initialPreset || "female");
  const [voiceName, setVoiceName] = useState(
    initialVoiceName ||
      VOICE_OPTIONS.find((o) => o.value === (initialPreset || "female"))?.defaultName ||
      ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handlePresetChange(val: VoicePreset) {
    setPreset(val);
    const opt = VOICE_OPTIONS.find((o) => o.value === val);
    if (opt?.defaultName && !voiceName) {
      setVoiceName(opt.defaultName);
    } else if (opt?.defaultName) {
      // Only replace if current name matches the other preset's default
      const otherDefaults = VOICE_OPTIONS.filter((o) => o.value !== val).map((o) => o.defaultName);
      if (otherDefaults.includes(voiceName)) {
        setVoiceName(opt.defaultName);
      }
    }
  }

  async function handleContinue() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/receptionist/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_preset: preset,
          voice_name: voiceName.trim() || (VOICE_OPTIONS.find((o) => o.value === preset)?.defaultName ?? ""),
        }),
      });
      const data = (await res.json()) as { settings?: unknown; error?: string };
      if (!res.ok || !data.settings) {
        setError(data.error ?? "Could not save voice settings.");
        setSaving(false);
        return;
      }
      router.replace("/setup/social");
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function handleSkip() {
    router.replace("/setup/social");
  }

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">Step 4 of 6 — AI Receptionist</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">Choose your AI receptionist voice</h1>
            <p className="crm-auth-subtitle">
              Your receptionist answers calls 24/7, qualifies leads, and logs them to your CRM automatically.
            </p>
          </div>

          <div className="crm-stack-10">
            {/* Voice picker */}
            <div className="crm-stack-10">
              {VOICE_OPTIONS.map((opt) => {
                const isActive = preset === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePresetChange(opt.value)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: `2px solid ${isActive ? "var(--ink-primary)" : "var(--border, #e2e8f0)"}`,
                      background: isActive ? "var(--surface-accent, #f0f4ff)" : "var(--surface-1, #fff)",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `2px solid ${isActive ? "var(--ink-primary)" : "var(--border)"}`,
                        background: isActive ? "var(--ink-primary)" : "transparent",
                        flexShrink: 0,
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isActive && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* AI name */}
            {preset !== "custom" && (
              <label className="crm-public-intake-field crm-public-intake-field-full">
                <span style={{ fontWeight: 600 }}>What should your receptionist be called?</span>
                <input
                  className="crm-input"
                  type="text"
                  placeholder={VOICE_OPTIONS.find((o) => o.value === preset)?.defaultName ?? "e.g. Natalee"}
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  maxLength={40}
                />
                <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  Callers will hear this name when the AI introduces itself.
                </span>
              </label>
            )}

            {preset === "custom" && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "var(--surface-2, #f8fafc)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--ink-muted)",
                  lineHeight: 1.6,
                }}
              >
                After finishing setup, go to <strong>Settings → Receptionist</strong> to record and upload your voice sample. We&apos;ll clone it and have your receptionist sound just like you.
              </div>
            )}

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
          <div className="crm-auth-panel-kicker">Always on</div>
          <h2 className="crm-auth-panel-title">Never miss a call again.</h2>
          <p className="crm-auth-panel-body">
            Your AI receptionist picks up every call — nights, weekends, and holidays — qualifies
            the lead, and drops their info straight into your CRM so you can follow up fast.
          </p>
          <div className="crm-auth-value-list">
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Female and male voices are live immediately — no extra setup</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>My Voice clones your voice from a short recording</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>You can change your voice anytime in Receptionist Settings</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
