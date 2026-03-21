/**
 * GET /api/secretary/alerts/count
 *
 * Authenticated. Lightweight endpoint returning only the open alert count.
 * Used by the nav badge in layout.tsx.
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
  const { count, error } = await admin
    .from("receptionist_alerts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", auth.context.user.id)
    .eq("status", "open");

  if (error) return NextResponse.json({ count: 0 });

  return NextResponse.json({ count: count ?? 0 });
}
