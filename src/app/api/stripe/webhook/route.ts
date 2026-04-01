/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Processes subscription lifecycle events and keeps
 * agents.billing_tier and agents.settings.receptionist_settings.voice_tier in sync.
 *
 * Events handled:
 *   checkout.session.completed      — subscription activated after checkout
 *   customer.subscription.updated   — plan change, renewal, status change
 *   customer.subscription.deleted   — subscription canceled → downgrade to core_crm
 *   invoice.payment_failed          — payment failed → grace period (status=past_due only)
 *
 * Always returns 200 to Stripe even on business logic errors.
 * Only returns non-200 for invalid signatures.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripeClient, tierFromPriceId } from "@/lib/stripe";
import type { BillingTier } from "@/lib/stripe";
import { voiceTierForBillingTier } from "@/lib/billing";
import { mergeReceptionistIntoAgentSettings } from "@/lib/receptionist/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof supabaseAdmin>;

/** Resolve the LockboxHQ agent ID from a Stripe event.
 *  Primary: metadata.agent_id (stored at checkout creation).
 *  Fallback: stripe_customer_id index lookup.
 */
async function resolveAgentId(
  admin: AdminClient,
  customerId: string | null | undefined,
  metadataAgentId?: string | null
): Promise<string | null> {
  if (metadataAgentId) return metadataAgentId;

  if (!customerId) return null;

  const { data } = await admin
    .from("agents")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Apply a billing update atomically: updates flat columns AND JSONB voice_tier
 * in a single DB write so the two values can never drift.
 */
async function applyBillingUpdate(
  admin: AdminClient,
  agentId: string,
  update: {
    billing_tier: BillingTier;
    stripe_subscription_status: string;
    stripe_subscription_id?: string | null;
    stripe_customer_id?: string | null;
  }
): Promise<void> {
  // Load current settings for JSONB merge
  const { data: row } = await admin
    .from("agents")
    .select("settings")
    .eq("id", agentId)
    .maybeSingle();

  // Compute new voice_tier from billing_tier (canonical mapping in billing/index.ts)
  const newVoiceTier = voiceTierForBillingTier(update.billing_tier);

  // Merge voice_tier into receptionist_settings using existing utility
  const updatedSettings = mergeReceptionistIntoAgentSettings(row?.settings ?? null, {
    voice_tier: newVoiceTier,
  });

  // Single update: flat columns + JSONB in one round-trip
  const patch: Record<string, unknown> = {
    billing_tier: update.billing_tier,
    stripe_subscription_status: update.stripe_subscription_status,
    settings: updatedSettings,
    updated_at: new Date().toISOString(),
  };

  if (update.stripe_subscription_id !== undefined) {
    patch.stripe_subscription_id = update.stripe_subscription_id;
  }
  if (update.stripe_customer_id !== undefined) {
    patch.stripe_customer_id = update.stripe_customer_id;
  }

  const { error } = await admin.from("agents").update(patch).eq("id", agentId);

  if (error) {
    console.error("[stripe/webhook] DB update failed:", { agentId, error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  admin: AdminClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const agentId = await resolveAgentId(
    admin,
    typeof session.customer === "string" ? session.customer : null,
    session.metadata?.agent_id
  );

  if (!agentId) {
    console.warn("[stripe/webhook] checkout.session.completed: could not resolve agent_id", {
      sessionId: session.id,
    });
    return;
  }

  // Retrieve the full subscription to get the price ID and status
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  let billing_tier: BillingTier = "core_crm";
  let status = "active";

  if (subscriptionId) {
    try {
      const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
      status = sub.status;
      const priceId = sub.items.data[0]?.price?.id;
      billing_tier = (priceId && tierFromPriceId(priceId)) || "core_crm";
    } catch (err) {
      console.error("[stripe/webhook] Could not retrieve subscription:", err);
    }
  }

  await applyBillingUpdate(admin, agentId, {
    billing_tier,
    stripe_subscription_status: status,
    stripe_subscription_id: subscriptionId ?? null,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
  });

  console.log("[stripe/webhook] checkout.session.completed:", { agentId, billing_tier, status });
}

async function handleSubscriptionUpdated(
  admin: AdminClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;

  const agentId = await resolveAgentId(
    admin,
    customerId,
    subscription.metadata?.agent_id
  );

  if (!agentId) {
    console.warn("[stripe/webhook] subscription.updated: could not resolve agent_id", {
      subscriptionId: subscription.id,
    });
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const billing_tier: BillingTier =
    (priceId && tierFromPriceId(priceId)) || "core_crm";

  await applyBillingUpdate(admin, agentId, {
    billing_tier,
    stripe_subscription_status: subscription.status,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
  });

  console.log("[stripe/webhook] subscription.updated:", {
    agentId,
    billing_tier,
    status: subscription.status,
  });
}

async function handleSubscriptionDeleted(
  admin: AdminClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;

  const agentId = await resolveAgentId(
    admin,
    customerId,
    subscription.metadata?.agent_id
  );

  if (!agentId) {
    console.warn("[stripe/webhook] subscription.deleted: could not resolve agent_id", {
      subscriptionId: subscription.id,
    });
    return;
  }

  // Downgrade to core_crm — clear subscription ID but keep customer ID for resubscription
  await applyBillingUpdate(admin, agentId, {
    billing_tier: "core_crm",
    stripe_subscription_status: "canceled",
    stripe_subscription_id: null,
  });

  console.log("[stripe/webhook] subscription.deleted: downgraded to core_crm", { agentId });
}

async function handleInvoicePaymentFailed(
  admin: AdminClient,
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : null;

  if (!customerId) return;

  // Only update subscription status to past_due — do NOT change billing_tier.
  // This is the grace period: agent retains access while they fix their payment.
  const { error } = await admin
    .from("agents")
    .update({
      stripe_subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[stripe/webhook] invoice.payment_failed DB update failed:", error.message);
  } else {
    console.log("[stripe/webhook] invoice.payment_failed: marked past_due", { customerId });
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text().catch(() => "");
  const sig = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed.";
    console.warn("[stripe/webhook] Invalid signature:", message);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
        break;

      default:
        // Ignore all other event types
        break;
    }
  } catch (err) {
    // Log but always return 200 — prevents Stripe from retrying indefinitely
    console.error("[stripe/webhook] Handler error:", err);
  }

  return NextResponse.json({ received: true });
}
