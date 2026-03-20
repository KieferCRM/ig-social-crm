/**
 * GET /api/stripe/billing-status
 *
 * Authenticated. Returns the agent's current billing tier and subscription status.
 * Used by the billing settings page on mount.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const { data: row, error } = await admin
    .from("agents")
    .select("billing_tier, stripe_subscription_status, stripe_customer_id")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    billing_tier: row?.billing_tier ?? "core_crm",
    stripe_subscription_status: row?.stripe_subscription_status ?? null,
    has_stripe_customer: Boolean(row?.stripe_customer_id),
  });
}
