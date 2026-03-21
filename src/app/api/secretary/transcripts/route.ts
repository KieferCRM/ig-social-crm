/**
 * GET /api/secretary/transcripts
 *
 * Authenticated. Returns call interactions (voice/call channels) with
 * transcripts and summaries, sorted by most recent.
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
  const agentId = auth.context.user.id;

  const { data: calls, error } = await admin
    .from("lead_interactions")
    .select("id, created_at, channel, direction, interaction_type, status, raw_transcript, summary, structured_payload, lead_id")
    .eq("agent_id", agentId)
    .in("channel", ["voice", "call_inbound", "call_outbound"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = calls ?? [];
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))];

  let leadsMap: Record<string, { id: string; full_name: string | null; canonical_phone: string | null; lead_temp: string | null }> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await admin
      .from("leads")
      .select("id, full_name, canonical_phone, lead_temp")
      .in("id", leadIds);
    leadsMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  }

  const result = rows.map((r) => ({ ...r, leads: leadsMap[r.lead_id] ?? null }));

  return NextResponse.json({ calls: result });
}
