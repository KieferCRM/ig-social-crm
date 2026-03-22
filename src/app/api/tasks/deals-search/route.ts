/**
 * GET /api/tasks/deals-search
 *
 * Authenticated. Returns a lightweight deal list for the task modal deal picker.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("deals")
    .select("id, property_address, stage")
    .eq("agent_id", auth.context.user.id)
    .not("stage", "in", '("closed","dead","lost")')
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deals: data ?? [] });
}
