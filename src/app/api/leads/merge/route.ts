import { NextResponse } from "next/server";
import { withReminderOwnerColumn } from "@/lib/reminders";
import { supabaseServer } from "@/lib/supabase/server";
import { canDeleteOwnedRecord, loadAccessContext, ownerFilter } from "@/lib/access-context";

type MergeBody = {
  source_lead_id?: string;
  target_lead_id?: string;
};

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as MergeBody;
  const sourceId = body.source_lead_id || "";
  const targetId = body.target_lead_id || "";

  if (!sourceId || !targetId || sourceId === targetId) {
    return NextResponse.json(
      { error: "Provide different source_lead_id and target_lead_id." },
      { status: 400 }
    );
  }

  const { data: leads, error: leadError } = await supabase
    .from("leads")
    .select("id, intent, timeline, source, notes, stage, lead_temp, owner_user_id")
    .or(ownerFilter(auth.context))
    .in("id", [sourceId, targetId]);

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  const source = (leads || []).find((l) => l.id === sourceId);
  const target = (leads || []).find((l) => l.id === targetId);
  if (!source || !target) {
    return NextResponse.json({ error: "Source or target lead not found." }, { status: 404 });
  }

  if (!canDeleteOwnedRecord(auth.context, source.owner_user_id)) {
    return NextResponse.json(
      { error: "Role does not allow lead merge for records you do not own." },
      { status: 403 }
    );
  }

  const targetPatch: Record<string, string> = {};
  if (!target.intent && source.intent) targetPatch.intent = source.intent;
  if (!target.timeline && source.timeline) targetPatch.timeline = source.timeline;
  if (!target.source && source.source) targetPatch.source = source.source;
  if (!target.notes && source.notes) targetPatch.notes = source.notes;
  if (!target.lead_temp && source.lead_temp) targetPatch.lead_temp = source.lead_temp;
  if ((target.stage || "New") === "New" && source.stage && source.stage !== "New") {
    targetPatch.stage = source.stage;
  }

  if (Object.keys(targetPatch).length > 0) {
    targetPatch.time_last_updated = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("leads")
      .update(targetPatch)
      .eq("id", targetId)
      .or(ownerFilter(auth.context));

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { error: reminderError } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .update({ lead_id: targetId })
      .or(ownerFilter(auth.context, ownerColumn))
      .eq("lead_id", sourceId)
  );

  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("leads")
    .update({
      archived_at: new Date().toISOString(),
      notes: `Merged into ${targetId}${source.notes ? `\n\n${source.notes}` : ""}`,
      time_last_updated: new Date().toISOString(),
    })
    .eq("id", sourceId)
    .or(ownerFilter(auth.context));

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await supabase.from("lead_activity_log").insert({
    lead_id: targetId,
    actor_user_id: auth.context.user.id,
    action: "lead_merged",
    metadata: { source_lead_id: sourceId, target_lead_id: targetId },
  });

  return NextResponse.json({ ok: true, target_lead_id: targetId, source_lead_id: sourceId });
}
