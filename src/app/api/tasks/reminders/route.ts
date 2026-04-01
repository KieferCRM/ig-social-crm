/**
 * GET /api/tasks/reminders
 *
 * Authenticated. Returns pending follow-up reminders due within the next 7 days
 * (including overdue), enriched with lead display names.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { withReminderOwnerColumn } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agentId = auth.context.user.id;
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();

  const { data: reminders } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .select("id, lead_id, due_at, status, note, created_at")
      .eq(ownerColumn, agentId)
      .eq("status", "pending")
      .lte("due_at", sevenDaysOut)
      .order("due_at", { ascending: true })
      .limit(50)
  );

  const rows = reminders ?? [];
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean) as string[])];

  let leadsMap: Record<string, { id: string; full_name: string | null; canonical_phone: string | null }> = {};
  if (leadIds.length > 0) {
    const admin = supabaseAdmin();
    const { data: leads } = await admin
      .from("leads")
      .select("id, full_name, canonical_phone")
      .in("id", leadIds);
    leadsMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));
  }

  const result = rows.map((r) => ({
    ...r,
    lead: r.lead_id ? (leadsMap[r.lead_id] ?? null) : null,
  }));

  return NextResponse.json({ reminders: result });
}
