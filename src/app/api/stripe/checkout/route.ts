/**
 * POST /api/stripe/checkout
 *
 * Authenticated. Creates a Stripe Checkout session for upgrading to a paid tier.
 * Returns { url } — the client redirects to this URL.
 *
 * Body: { tier: 'secretary_sms' | 'secretary_voice', interval: 'month' | 'year' }
 *
 * Note: 'core_crm' is not a valid checkout tier (it's the default free tier).
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";
import {
  getOrCreateStripeCustomer,
  priceIdForTier,
  createCheckoutSession,
  type BillingTier,
  type BillingInterval,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutBody = {
  tier: BillingTier;
  interval: BillingInterval;
};

const VALID_TIERS = new Set<BillingTier>(["secretary_sms", "secretary_voice"]);
const VALID_INTERVALS = new Set<BillingInterval>(["month", "year"]);

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<CheckoutBody>(request, { maxBytes: 4 * 1024 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { tier, interval } = parsed.data;

  if (!VALID_TIERS.has(tier)) {
    return NextResponse.json(
      { error: "Invalid tier. Must be 'secretary_sms' or 'secretary_voice'." },
      { status: 400 }
    );
  }

  if (!VALID_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "Invalid interval. Must be 'month' or 'year'." },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const { data: agentRow } = await admin
    .from("agents")
    .select("email, full_name, stripe_customer_id, billing_tier")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  // Already on this tier or higher — no need to checkout
  const currentTierRank =
    agentRow?.billing_tier === "secretary_voice" ? 2
    : agentRow?.billing_tier === "secretary_sms" ? 1
    : 0;
  const requiredRank = tier === "secretary_voice" ? 2 : 1;

  if (currentTierRank >= requiredRank) {
    return NextResponse.json(
      { error: "You are already on this plan or a higher plan." },
      { status: 400 }
    );
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    auth.context.user.id,
    agentRow?.email ?? auth.context.user.email ?? "",
    agentRow?.full_name ?? null
  );

  // Get the price ID for the requested tier + interval
  let priceId: string;
  try {
    priceId = priceIdForTier(tier, interval);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Price not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  // Build redirect URLs
  const origin =
    request.headers.get("origin") ??
    request.headers.get("referer")?.replace(/\/$/, "") ??
    (process.env.NEXT_PUBLIC_SITE_URL ? `https://${process.env.NEXT_PUBLIC_SITE_URL}` : "");

  const session = await createCheckoutSession({
    customerId,
    priceId,
    agentId: auth.context.user.id,
    successUrl: `${origin}/app/settings/billing?success=1`,
    cancelUrl: `${origin}/app/settings/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
