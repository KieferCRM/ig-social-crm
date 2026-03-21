/**
 * GET /api/tasks/stale-deals
 *
 * Authenticated. Returns deals with no activity in the last 5 days.
 * Used by the "Update This Deal" column on the Tasks page.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STALE_DAYS = 5;

export async function GET(): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 3600_000).toISOString();

  const { data, error } = await supabase
    .from("deals")
    .select("id, lead_id, property_address, stage, updated_at")
    .eq("agent_id", auth.context.user.id)
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(12);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deals: data ?? [] });
}
