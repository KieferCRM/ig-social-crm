/**
 * GET /api/secretary/alerts
 *
 * Authenticated. Returns all receptionist_alerts for the agent (open first,
 * then resolved), merged with lead display fields. Also returns open_count
 * for nav badge use.
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

  const { data: alerts, error } = await admin
    .from("receptionist_alerts")
    .select("id, created_at, alert_type, severity, title, message, status, metadata, lead_id")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = alerts ?? [];
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean) as string[])];

  let leadsMap: Record<string, { id: string; full_name: string | null; canonical_phone: string | null; lead_temp: string | null }> = {};
  if (leadIds.length > 0) {
    const { data: leads } = await admin
      .from("leads")
      .select("id, full_name, canonical_phone, lead_temp")
      .in("id", leadIds);
    leadsMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  }

  const result = rows.map((r) => ({
    ...r,
    leads: r.lead_id ? (leadsMap[r.lead_id] ?? null) : null,
  }));

  const openCount = result.filter((a) => a.status === "open").length;

  return NextResponse.json({ alerts: result, open_count: openCount });
}
