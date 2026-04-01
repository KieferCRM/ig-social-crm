/**
 * GET /api/secretary/conversations
 *
 * Authenticated. Returns the most recent SMS/textback interaction per lead,
 * sorted by most recent. Used by the Secretary Conversations tab.
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

  const { data: interactions, error } = await admin
    .from("lead_interactions")
    .select("id, created_at, channel, direction, status, raw_message_body, lead_id")
    .eq("agent_id", agentId)
    .in("channel", ["sms", "missed_call_textback"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate: keep the most recent interaction per lead
  const seen = new Set<string>();
  const threads = (interactions ?? []).filter((i) => {
    if (!i.lead_id || seen.has(i.lead_id)) return false;
    seen.add(i.lead_id);
    return true;
  });

  const leadIds = threads.map((t) => t.lead_id).filter(Boolean);
  let leadsMap: Record<string, { id: string; full_name: string | null; canonical_phone: string | null; lead_temp: string | null }> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await admin
      .from("leads")
      .select("id, full_name, canonical_phone, lead_temp")
      .in("id", leadIds);
    leadsMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  }

  const result = threads.map((t) => ({ ...t, leads: leadsMap[t.lead_id] ?? null }));

  return NextResponse.json({ threads: result });
}
