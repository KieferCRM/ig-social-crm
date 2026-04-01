"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FounderState = {
  isFounder: boolean;
  account_type: string | null;
  billing_tier: string | null;
};

const ACCOUNT_TYPES = [
  { value: "solo_agent", label: "Traditional" },
  { value: "off_market_agent", label: "Nontraditional" },
  { value: "team_brokerage", label: "Teams / Brokerage" },
];

const BILLING_TIERS = [
  { value: "core_crm", label: "Core CRM" },
  { value: "secretary_sms", label: "Secretary SMS" },
  { value: "secretary_voice", label: "Secretary Voice" },
];

export default function FounderSwitcher() {
  const router = useRouter();
  const [state, setState] = useState<FounderState | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    void fetch("/api/founder/switch")
      .then(r => r.json())
      .then(d => setState(d as FounderState))
      .catch(() => { /* not founder */ });
  }, []);

  if (!state?.isFounder) return null;

  async function switchTo(key: "account_type" | "billing_tier", value: string) {
    setSwitching(true);
    await fetch("/api/founder/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setState(prev => prev ? { ...prev, [key]: value } : prev);
    setSwitching(false);
    router.refresh();
    // Full reload to pick up server-side account type changes
    window.location.reload();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          background: open ? "#1e1b4b" : "#312e81",
          color: "#c7d2fe",
          border: "none",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.05em",
          textAlign: "left",
        }}
      >
        ⚡ FOUNDER {open ? "▲" : "▼"}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: "#1e1b4b",
          border: "1px solid #4338ca",
          borderRadius: 10,
          padding: 12,
          zIndex: 1000,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Account Type
          </div>
          <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            {ACCOUNT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                disabled={switching}
                onClick={() => void switchTo("account_type", t.value)}
                style={{
                  background: state.account_type === t.value ? "#4338ca" : "rgba(255,255,255,0.06)",
                  color: state.account_type === t.value ? "#fff" : "#a5b4fc",
                  border: state.account_type === t.value ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: state.account_type === t.value ? 700 : 400,
                }}
              >
                {state.account_type === t.value ? "✓ " : ""}{t.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Billing Tier
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {BILLING_TIERS.map(t => (
              <button
                key={t.value}
                type="button"
                disabled={switching}
                onClick={() => void switchTo("billing_tier", t.value)}
                style={{
                  background: state.billing_tier === t.value ? "#4338ca" : "rgba(255,255,255,0.06)",
                  color: state.billing_tier === t.value ? "#fff" : "#a5b4fc",
                  border: state.billing_tier === t.value ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: state.billing_tier === t.value ? 700 : 400,
                }}
              >
                {state.billing_tier === t.value ? "✓ " : ""}{t.label}
              </button>
            ))}
          </div>

          {switching && (
            <div style={{ fontSize: 11, color: "#818cf8", marginTop: 8, textAlign: "center" }}>
              Switching...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
