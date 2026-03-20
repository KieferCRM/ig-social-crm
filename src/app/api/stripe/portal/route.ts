/**
 * POST /api/stripe/portal
 *
 * Authenticated. Creates a Stripe Customer Portal session.
 * Returns { url } — the client redirects to this URL.
 *
 * Used for: plan changes, payment method updates, subscription cancellation.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { createPortalSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const { data: agentRow } = await admin
    .from("agents")
    .select("stripe_customer_id")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (!agentRow?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe first." },
      { status: 404 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    request.headers.get("referer")?.replace(/\/$/, "") ??
    (process.env.NEXT_PUBLIC_SITE_URL ? `https://${process.env.NEXT_PUBLIC_SITE_URL}` : "");

  const portalSession = await createPortalSession({
    customerId: agentRow.stripe_customer_id,
    returnUrl: `${origin}/app/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
