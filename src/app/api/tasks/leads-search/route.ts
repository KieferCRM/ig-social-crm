/**
 * GET /api/tasks/leads-search
 *
 * Authenticated. Returns a lightweight lead list for the Add Task modal dropdown.
 * Includes enough fields to display a human-readable lead name.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ownerClause = [
    ownerFilter(auth.context, "agent_id"),
    ownerFilter(auth.context, "owner_user_id"),
    ownerFilter(auth.context, "assignee_user_id"),
  ].join(",");

  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, first_name, last_name, canonical_phone, ig_username")
    .or(ownerClause)
    .order("full_name", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [] });
}
