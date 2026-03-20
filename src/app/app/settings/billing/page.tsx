"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TIER_LABELS, TIER_FEATURES, type BillingTier } from "@/lib/billing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BillingStatus = {
  billing_tier: BillingTier;
  stripe_subscription_status: string | null;
  has_stripe_customer: boolean;
};

type BillingInterval = "month" | "year";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  string,
  { label: string; style: React.CSSProperties }
> = {
  active:   { label: "Active",        style: { color: "#16a34a", background: "#dcfce7", borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: 13 } },
  trialing: { label: "Trial",         style: { color: "#0369a1", background: "#e0f2fe", borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: 13 } },
  past_due: { label: "Payment issue", style: { color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: 13 } },
  canceled: { label: "Canceled",      style: { color: "#dc2626", background: "#fee2e2", borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: 13 } },
  paused:   { label: "Paused",        style: { color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: 13 } },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>Free</span>;
  const meta = STATUS_BADGE[status] ?? { label: status, style: { fontWeight: 600, fontSize: 13 } };
  return <span style={meta.style}>{meta.label}</span>;
}

// ---------------------------------------------------------------------------
// Tier card data
// ---------------------------------------------------------------------------

const TIERS: { tier: BillingTier; price: { month: string; year: string } }[] = [
  { tier: "core_crm",       price: { month: "Free",   year: "Free" } },
  { tier: "secretary_sms",  price: { month: "Contact us", year: "Contact us" } },
  { tier: "secretary_voice",price: { month: "Contact us", year: "Contact us" } },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<BillingTier | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [banner, setBanner] = useState<{ type: "success" | "info" | "error"; message: string } | null>(null);

  // Handle success/canceled URL params
  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setBanner({ type: "success", message: "Your plan has been updated. Welcome to your new tier!" });
      router.replace("/app/settings/billing", { scroll: false });
    } else if (searchParams.get("canceled") === "1") {
      setBanner({ type: "info", message: "Upgrade canceled. Your current plan is unchanged." });
      router.replace("/app/settings/billing", { scroll: false });
    }
  }, [searchParams, router]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/billing-status");
      if (res.ok) {
        const data = await res.json() as BillingStatus;
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  async function handleUpgrade(tier: BillingTier) {
    if (tier === "core_crm") return;
    setUpgrading(tier);
    setBanner(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setBanner({ type: "error", message: data.error ?? "Could not start checkout." });
        setUpgrading(null);
      }
    } catch {
      setBanner({ type: "error", message: "Something went wrong. Please try again." });
      setUpgrading(null);
    }
  }

  async function handleManageBilling() {
    setOpeningPortal(true);
    setBanner(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setBanner({ type: "error", message: data.error ?? "Could not open billing portal." });
        setOpeningPortal(false);
      }
    } catch {
      setBanner({ type: "error", message: "Something went wrong. Please try again." });
      setOpeningPortal(false);
    }
  }

  const currentTier = status?.billing_tier ?? "core_crm";
  const currentRank = currentTier === "secretary_voice" ? 2 : currentTier === "secretary_sms" ? 1 : 0;

  return (
    <div className="crm-page-shell">
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Billing</h1>
          <p className="crm-page-subtitle">
            Manage your subscription, upgrade your plan, and update payment details.
          </p>
        </div>
        <Link href="/app/settings" className="crm-btn crm-btn-secondary" style={{ alignSelf: "flex-start" }}>
          ← Settings
        </Link>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className="crm-card"
          style={{
            background: banner.type === "success" ? "#f0fdf4" : banner.type === "error" ? "#fef2f2" : "#eff6ff",
            border: `1px solid ${banner.type === "success" ? "#bbf7d0" : banner.type === "error" ? "#fecaca" : "#bfdbfe"}`,
            color: banner.type === "success" ? "#166534" : banner.type === "error" ? "#991b1b" : "#1e40af",
            padding: "12px 16px",
            borderRadius: 8,
          }}
        >
          {banner.message}
        </div>
      )}

      {/* Past-due warning */}
      {status?.stripe_subscription_status === "past_due" && (
        <div
          className="crm-card"
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            padding: "12px 16px",
            borderRadius: 8,
          }}
        >
          <strong>Payment issue.</strong> Your last payment failed. Please update your payment method
          to avoid losing access.{" "}
          <button
            className="crm-btn crm-btn-secondary"
            style={{ marginLeft: 8, padding: "2px 10px", fontSize: 13 }}
            onClick={() => void handleManageBilling()}
          >
            Update card
          </button>
        </div>
      )}

      {loading ? (
        <div className="crm-card crm-section-card">
          <p style={{ color: "var(--ink-muted)" }}>Loading billing information…</p>
        </div>
      ) : (
        <>
          {/* Current Plan Card */}
          <section className="crm-card crm-section-card crm-stack-10">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div className="crm-stack-10">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>
                    {TIER_LABELS[currentTier]}
                  </span>
                  <StatusBadge status={status?.stripe_subscription_status ?? null} />
                </div>
                <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
                  {currentTier === "core_crm"
                    ? "You are on the free Core CRM plan."
                    : "Your subscription is managed through Stripe."}
                </p>
              </div>
              {status?.has_stripe_customer && (
                <button
                  className="crm-btn crm-btn-secondary"
                  onClick={() => void handleManageBilling()}
                  disabled={openingPortal}
                >
                  {openingPortal ? "Opening portal…" : "Manage billing →"}
                </button>
              )}
            </div>
          </section>

          {/* Billing interval toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, color: "var(--ink-muted)" }}>Billing interval:</span>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
              {(["month", "year"] as BillingInterval[]).map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  style={{
                    padding: "4px 14px",
                    fontSize: 13,
                    fontWeight: interval === i ? 700 : 400,
                    background: interval === i ? "var(--ink-primary)" : "transparent",
                    color: interval === i ? "#fff" : "var(--ink-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {i === "month" ? "Monthly" : "Annual (save ~17%)"}
                </button>
              ))}
            </div>
          </div>

          {/* Tier Comparison Cards */}
          <div className="crm-grid-cards-3">
            {TIERS.map(({ tier, price }) => {
              const tierRank = tier === "secretary_voice" ? 2 : tier === "secretary_sms" ? 1 : 0;
              const isCurrent = tier === currentTier;
              const isUpgrade = tierRank > currentRank;
              const isDowngrade = tierRank < currentRank;

              return (
                <section
                  key={tier}
                  className="crm-card crm-section-card crm-stack-10"
                  style={{
                    border: isCurrent ? "2px solid var(--ink-primary)" : undefined,
                    position: "relative",
                  }}
                >
                  {isCurrent && (
                    <div
                      style={{
                        position: "absolute",
                        top: -1,
                        right: 12,
                        background: "var(--ink-primary)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "0 0 6px 6px",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}
                    >
                      Current plan
                    </div>
                  )}

                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                      {TIER_LABELS[tier]}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                      {price[interval]}
                    </div>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--ink-body)", lineHeight: 1.7 }}>
                    {TIER_FEATURES[tier].map((feature) => (
                      <li key={feature} style={{ color: tierRank <= currentRank || isCurrent ? "inherit" : "var(--ink-muted)" }}>
                        {tierRank > currentRank && !isCurrent && (
                          <span style={{ marginRight: 4 }}>🔒</span>
                        )}
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div>
                    {isCurrent ? (
                      <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                        {tier === "core_crm" ? "Free forever" : "Your current plan"}
                      </span>
                    ) : isUpgrade ? (
                      <button
                        className="crm-btn crm-btn-primary"
                        onClick={() => void handleUpgrade(tier)}
                        disabled={upgrading !== null}
                        style={{ width: "100%" }}
                      >
                        {upgrading === tier ? "Starting checkout…" : `Upgrade to ${TIER_LABELS[tier]}`}
                      </button>
                    ) : isDowngrade ? (
                      <button
                        className="crm-btn crm-btn-secondary"
                        onClick={() => void handleManageBilling()}
                        disabled={openingPortal || !status?.has_stripe_customer}
                        style={{ width: "100%" }}
                      >
                        {openingPortal ? "Opening portal…" : "Downgrade via portal"}
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Voice Clone Add-on — shown only for Secretary Voice agents */}
          {currentTier === "secretary_voice" && (
            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Voice Cloning Add-on</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Clone your voice using 60 seconds of audio. Once set up, your AI secretary will
                answer calls in your own voice.
              </p>
              <div>
                <Link href="/app/settings/receptionist" className="crm-btn crm-btn-secondary">
                  Set up voice cloning →
                </Link>
              </div>
            </section>
          )}

          {/* Upgrade prompt for locked features — shown for core_crm and secretary_sms */}
          {currentTier !== "secretary_voice" && (
            <section className="crm-card crm-section-card" style={{ background: "var(--surface-subtle, #f9fafb)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
                {currentTier === "core_crm"
                  ? "Upgrade to Secretary SMS to unlock AI lead qualification, missed call textback, and more."
                  : "Upgrade to Secretary Voice to unlock AI call answering, voice transcription, and call bridging."}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
