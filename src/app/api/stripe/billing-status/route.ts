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
    .select("billing_tier, stripe_subscription_status, stripe_customer_id, role")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Founders see secretary_voice regardless of actual billing_tier
  const isFounder = row?.role === "founder";

  return NextResponse.json({
    billing_tier: isFounder ? "secretary_voice" : (row?.billing_tier ?? "core_crm"),
    stripe_subscription_status: isFounder ? "active" : (row?.stripe_subscription_status ?? null),
    has_stripe_customer: isFounder ? false : Boolean(row?.stripe_customer_id),
    is_founder: isFounder,
  });
}
