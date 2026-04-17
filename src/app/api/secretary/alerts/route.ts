/**
 * GET /api/secretary/alerts
 * Supports ?status=open&type=form_submission,call_inbound query params for filtering.
 *
 * PATCH /api/secretary/alerts
 * Body: { scope: "all_resolved" | "all_open" | "all" } — bulk status update.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const agentId = auth.context.user.id;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status"); // "open" | "resolved" | null (all)
  const typeFilter = url.searchParams.get("type");     // comma-separated alert_types

  let query = admin
    .from("receptionist_alerts")
    .select("id, created_at, alert_type, severity, title, message, status, metadata, lead_id")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (typeFilter) {
    const types = typeFilter.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) query = query.in("alert_type", types);
  }

  const { data: alerts, error } = await query;
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

type BulkBody = { scope?: "all_resolved" | "all_open" | "all" };

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<BulkBody>(request, { maxBytes: 512 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const scope = parsed.data.scope ?? "all_resolved";
  const admin = supabaseAdmin();
  const agentId = auth.context.user.id;

  let query = admin
    .from("receptionist_alerts")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("agent_id", agentId);

  if (scope === "all_resolved") query = query.eq("status", "resolved");
  else if (scope === "all_open") query = query.eq("status", "open");
  // scope === "all" → no extra filter, update everything

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
