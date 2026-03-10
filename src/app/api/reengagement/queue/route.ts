import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { withReminderOwnerColumn } from "@/lib/reminders";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 3600_000).toISOString();
}

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const staleBefore = daysAgoIso(14);

  const [{ data: leads, error: leadError }, { data: pendingReminders, error: reminderError }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id,ig_username,time_last_updated,stage,lead_temp,last_message_preview")
        .or(ownerFilter(auth.context))
        .lt("time_last_updated", staleBefore)
        .neq("stage", "Closed")
        .order("time_last_updated", { ascending: true })
        .limit(50),
      withReminderOwnerColumn((ownerColumn) =>
        supabase
          .from("follow_up_reminders")
          .select("lead_id")
          .or(ownerFilter(auth.context, ownerColumn))
          .eq("status", "pending")
      ),
    ]);

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (reminderError) return NextResponse.json({ error: reminderError.message }, { status: 500 });

  const leadsWithPending = new Set(
    (pendingReminders || []).map((r) => r.lead_id).filter((id): id is string => Boolean(id))
  );

  const queue = (leads || []).filter((lead) => !leadsWithPending.has(lead.id));

  return NextResponse.json({ queue });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as { lead_id?: string };
  const leadId = body.lead_id || "";
  if (!leadId) return NextResponse.json({ error: "lead_id is required." }, { status: 400 });

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .or(ownerFilter(auth.context))
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const { data: existingPending, error: pendingError } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .select("id")
      .or(ownerFilter(auth.context, ownerColumn))
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .maybeSingle()
  );
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
  if (existingPending?.id) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Pending reminder already exists." });
  }

  const dueAt = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { data, error } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .insert({
        [ownerColumn]: auth.context.user.id,
        lead_id: leadId,
        due_at: dueAt,
        status: "pending",
        preset: "1d",
        note: "Auto re-engagement queue reminder",
      })
      .select("id, lead_id, conversation_id, due_at, status, note, preset, created_at, updated_at")
      .single()
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}
