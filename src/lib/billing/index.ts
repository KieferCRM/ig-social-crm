/**
 * src/lib/billing/index.ts
 *
 * Feature tier gating utilities.
 * Use checkAgentTier() in API routes to gate features behind subscription tiers.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingTier = "core_crm" | "secretary_sms" | "secretary_voice";

// ---------------------------------------------------------------------------
// Tier ordering
// ---------------------------------------------------------------------------

const TIER_RANK: Record<BillingTier, number> = {
  core_crm: 0,
  secretary_sms: 1,
  secretary_voice: 2,
};

export function tierRank(tier: BillingTier | string | null | undefined): number {
  if (!tier) return 0;
  return TIER_RANK[tier as BillingTier] ?? 0;
}

// ---------------------------------------------------------------------------
// billing_tier → voice_tier mapping
//
// This is the ONLY place this mapping is defined.
// Always called inside applyBillingUpdate() in the webhook handler.
// ---------------------------------------------------------------------------

export function voiceTierForBillingTier(tier: BillingTier): "none" | "sms" | "voice" {
  switch (tier) {
    case "secretary_voice": return "voice";
    case "secretary_sms":   return "sms";
    case "core_crm":
    default:                return "none";
  }
}

// ---------------------------------------------------------------------------
// Tier check
// ---------------------------------------------------------------------------

// Subscription statuses that block elevated access (remove billing_tier benefit).
// past_due is intentionally excluded — it is a grace period.
const BLOCKING_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

/**
 * Returns whether an agent has access to a given tier.
 * Safe for server-side use only (uses supabaseAdmin).
 *
 * Grace period policy: past_due subscriptions retain access.
 * Access is only removed when status is canceled/unpaid/incomplete_expired.
 *
 * Founder bypass: agents with role = 'founder' always get full access,
 * regardless of billing_tier or subscription status.
 */
export async function checkAgentTier(
  agentId: string,
  requiredTier: BillingTier
): Promise<{
  allowed: boolean;
  currentTier: BillingTier;
  subscriptionStatus: string | null;
}> {
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("agents")
    .select("billing_tier, stripe_subscription_status, role")
    .eq("id", agentId)
    .maybeSingle();

  // Founders bypass all tier restrictions
  if (row?.role === "founder") {
    return {
      allowed: true,
      currentTier: "secretary_voice",
      subscriptionStatus: row.stripe_subscription_status ?? null,
    };
  }

  const storedTier = (row?.billing_tier ?? "core_crm") as BillingTier;
  const status = (row?.stripe_subscription_status ?? null) as string | null;

  // If subscription is in a blocking terminal state and tier is elevated,
  // treat the effective tier as core_crm (access revoked).
  const effectiveTier: BillingTier =
    storedTier !== "core_crm" && BLOCKING_STATUSES.has(status ?? "")
      ? "core_crm"
      : storedTier;

  return {
    allowed: tierRank(effectiveTier) >= tierRank(requiredTier),
    currentTier: effectiveTier,
    subscriptionStatus: status,
  };
}

// ---------------------------------------------------------------------------
// Upgrade prompt helper (for API responses)
// ---------------------------------------------------------------------------

export function upgradePrompt(requiredTier: BillingTier): {
  upgrade_required: true;
  required_tier: BillingTier;
  upgrade_url: string;
} {
  return {
    upgrade_required: true,
    required_tier: requiredTier,
    upgrade_url: "/app/settings/billing",
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const TIER_LABELS: Record<BillingTier, string> = {
  core_crm: "Core CRM",
  secretary_sms: "Secretary SMS",
  secretary_voice: "Secretary Voice",
};

export const TIER_FEATURES: Record<BillingTier, string[]> = {
  core_crm: [
    "Full CRM & lead management",
    "Off-market pipeline",
    "Seller & buyer forms",
    "Deal tracking",
    "Commission tracking",
  ],
  secretary_sms: [
    "Everything in Core CRM",
    "Inbound SMS lead qualification",
    "Missed call textback",
    "Form submission alerts",
    "Manual SMS from CRM",
    "Urgency scoring",
    "Lead temperature auto-assignment",
  ],
  secretary_voice: [
    "Everything in Secretary SMS",
    "AI inbound call handling",
    "Call qualification by voice",
    "Call transcription",
    "Call bridging to agent",
    "After-hours voice handling",
    "Preset voice library (8 voices)",
    "Voice cloning (add-on)",
  ],
};
