/**
 * src/lib/stripe/index.ts
 *
 * Stripe client singleton and session helpers.
 * All Stripe interaction in this codebase goes through this module.
 * Never instantiate Stripe directly elsewhere.
 */
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingTier = "core_crm" | "secretary_sms" | "secretary_voice";
export type BillingInterval = "month" | "year";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

export function stripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Price ID lookup
// ---------------------------------------------------------------------------

const PRICE_ENV_MAP: Record<BillingTier, Record<BillingInterval, string>> = {
  core_crm: {
    month: "STRIPE_CORE_CRM_PRICE_ID",
    year: "STRIPE_CORE_CRM_ANNUAL_PRICE_ID",
  },
  secretary_sms: {
    month: "STRIPE_SMS_PRICE_ID",
    year: "STRIPE_SMS_ANNUAL_PRICE_ID",
  },
  secretary_voice: {
    month: "STRIPE_VOICE_PRICE_ID",
    year: "STRIPE_VOICE_ANNUAL_PRICE_ID",
  },
};

/**
 * Returns the Stripe price ID for a given tier and billing interval.
 * Throws a clear error if the env var is not configured.
 */
export function priceIdForTier(tier: BillingTier, interval: BillingInterval): string {
  const envKey = PRICE_ENV_MAP[tier]?.[interval];
  if (!envKey) throw new Error(`No price ID configured for tier="${tier}" interval="${interval}".`);
  const priceId = process.env[envKey];
  if (!priceId) throw new Error(`Env var ${envKey} is not set. Configure it in your environment.`);
  return priceId;
}

/**
 * Reverse lookup: given a Stripe price ID, return the corresponding billing tier.
 * Returns null if the price ID is not recognized (e.g. voice clone add-on).
 */
export function tierFromPriceId(priceId: string): BillingTier | null {
  const map: Record<string, BillingTier> = {};
  const tiers: BillingTier[] = ["core_crm", "secretary_sms", "secretary_voice"];
  const intervals: BillingInterval[] = ["month", "year"];
  for (const tier of tiers) {
    for (const interval of intervals) {
      const envKey = PRICE_ENV_MAP[tier][interval];
      const id = process.env[envKey];
      if (id) map[id] = tier;
    }
  }
  return map[priceId] ?? null;
}

// ---------------------------------------------------------------------------
// Customer management
// ---------------------------------------------------------------------------

/**
 * Returns the existing Stripe customer ID for an agent, or creates a new one.
 * Always writes the customer ID back to agents.stripe_customer_id if newly created.
 */
export async function getOrCreateStripeCustomer(
  agentId: string,
  email: string,
  name: string | null
): Promise<string> {
  const admin = supabaseAdmin();

  // Check if we already have a customer ID
  const { data: row } = await admin
    .from("agents")
    .select("stripe_customer_id")
    .eq("id", agentId)
    .maybeSingle();

  if (row?.stripe_customer_id) {
    // Verify the customer still exists in Stripe
    try {
      const customer = await stripeClient().customers.retrieve(row.stripe_customer_id);
      if (!("deleted" in customer) || !customer.deleted) {
        return row.stripe_customer_id;
      }
    } catch {
      // Customer not found in Stripe — fall through to create a new one
    }
  }

  // Create a new Stripe customer
  const customer = await stripeClient().customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { agent_id: agentId },
  });

  // Store the new customer ID
  await admin
    .from("agents")
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq("id", agentId);

  return customer.id;
}

// ---------------------------------------------------------------------------
// Checkout session
// ---------------------------------------------------------------------------

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  agentId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripeClient().checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    // Store agent_id in metadata for webhook agent resolution
    subscription_data: {
      metadata: { agent_id: params.agentId },
    },
    metadata: { agent_id: params.agentId },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });
}

// ---------------------------------------------------------------------------
// Customer portal session
// ---------------------------------------------------------------------------

export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripeClient().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}
