"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import LockboxMark from "@/components/branding/lockbox-mark";
import type { AccountType } from "@/lib/onboarding";

type EnabledAccountType = Extract<AccountType, "solo_agent" | "off_market_agent">;

type Props = {
  recommendedType: EnabledAccountType;
};

type Option = {
  value: AccountType;
  title: string;
  body: string;
  bullets: string[];
  disabled?: boolean;
  badge?: string;
};

const OPTIONS: Option[] = [
  {
    value: "solo_agent",
    title: "Traditional",
    body: "Full inbound CRM for agents running a traditional real estate practice with buyers and listings.",
    bullets: [
      "Separate buyer and listing pipelines",
      "TC checklist, docs, and follow-up built in",
      "Intake forms, lead board, and daily Today view",
    ],
    badge: "Recommended",
  },
  {
    value: "off_market_agent",
    title: "Nontraditional",
    body: "Acquisition and disposition focused workspace built for off-market and investment-focused agents.",
    bullets: [
      "Seller acquisition focus",
      "Disposition workflow context",
      "Buyer blast and analysis examples",
    ],
  },
  {
    value: "team_brokerage",
    title: "Team / Brokerage",
    body: "Future path for multi-user setup, shared pipeline management, and team workflow controls.",
    bullets: [
      "Shared workspace controls",
      "Team routing and ownership",
      "Not shipping in this phase",
    ],
    disabled: true,
    badge: "Coming soon",
  },
];

export default function AccountTypeClient({ recommendedType }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<EnabledAccountType>(recommendedType);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedOption = useMemo(
    () => OPTIONS.find((option) => option.value === selected) || OPTIONS[0],
    [selected]
  );

  async function completeSetup() {
    setSaving(true);
    setMessage("");

    try {
      const selectResponse = await fetch("/api/onboarding/account-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: selected }),
      });
      const selectData = (await selectResponse.json()) as { ok?: boolean; error?: string };
      if (!selectResponse.ok || !selectData.ok) {
        setMessage(selectData.error || "Could not save account type.");
        setSaving(false);
        return;
      }

      // Proceed to profile setup
      router.replace("/setup/profile");
    } catch {
      setMessage("Could not finish workspace setup.");
      setSaving(false);
    }
  }

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">Step 1 of 6 — Workspace type</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">Choose your workspace path</h1>
            <p className="crm-auth-subtitle">
              This picks the sample workspace and first-run orientation. You can keep the app shell shared while
              starting from the right operating context.
            </p>
            <p className="crm-auth-helper">
              Solo Agent is the default path. Off-Market Agent opens the same product with acquisition and
              disposition-oriented examples.
            </p>
          </div>

          <div className="crm-account-type-grid">
            {OPTIONS.map((option) => {
              const isActive = option.value === selected;
              const isDisabled = Boolean(option.disabled);
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isDisabled || saving}
                  onClick={() => {
                    if (!isDisabled) setSelected(option.value as EnabledAccountType);
                  }}
                  className={`crm-account-type-card${isActive ? " crm-account-type-card-active" : ""}${isDisabled ? " crm-account-type-card-disabled" : ""}`}
                >
                  <div className="crm-account-type-card-head">
                    <strong>{option.title}</strong>
                    {option.badge ? (
                      <span className={`crm-chip${option.badge === "Recommended" ? " crm-chip-ok" : ""}`}>
                        {option.badge}
                      </span>
                    ) : null}
                  </div>
                  <p>{option.body}</p>
                  <ul className="crm-account-type-card-list">
                    {option.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {message ? (
            <div className="crm-auth-feedback crm-auth-feedback-error" role="alert">
              {message}
            </div>
          ) : null}

          <div className="crm-inline-actions" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="crm-auth-helper">
              Selected: <strong style={{ color: "var(--foreground)" }}>{selectedOption.title}</strong>
            </div>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => void completeSetup()}
              disabled={saving}
            >
              {saving ? "Setting up workspace..." : `Continue as ${selectedOption.title}`}
            </button>
          </div>
        </section>

        <aside className="crm-card crm-auth-trust-panel">
          <div className="crm-auth-panel-kicker">What changes</div>
          <h2 className="crm-auth-panel-title">The same product, a different starting context.</h2>
          <p className="crm-auth-panel-body">
            The app shell stays shared. What changes right now is the seeded sample data, first-run context, and the
            examples you see when you open Today, Deals, Intake, and Priorities.
          </p>

          <div className="crm-auth-value-list">
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Solo Agent opens with broad inbound buyer and seller examples</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Off-Market Agent opens with seller acquisition and buyer disposition examples</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Team/Brokerage stays visible, but it is not enabled yet</span>
            </div>
          </div>

          <div className="crm-auth-links">
            <Link href="/">Solo landing</Link>
            <Link href="/auth">Back to auth</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
