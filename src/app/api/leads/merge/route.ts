import { NextResponse } from "next/server";
import { withReminderOwnerColumn } from "@/lib/reminders";
import { supabaseServer } from "@/lib/supabase/server";
import { canDeleteOwnedRecord, loadAccessContext, ownerFilter } from "@/lib/access-context";

type MergeBody = {
  source_lead_id?: string;
  target_lead_id?: string;
};

type LeadMergeRecord = {
  id: string;
  intent: string | null;
  timeline: string | null;
  source: string | null;
  notes: string | null;
  stage: string | null;
  lead_temp: string | null;
  owner_user_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  raw_email: string | null;
  raw_phone: string | null;
  last_message_preview: string | null;
  next_step: string | null;
  source_detail: Record<string, unknown> | null;
};

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sourceDetailObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function mergeTags(targetTags: string | null, sourceTags: string | null): string | null {
  const split = (value: string | null): string[] =>
    (value || "")
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of [...split(targetTags), ...split(sourceTags)]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(item);
  }
  return ordered.length > 0 ? ordered.join(", ") : null;
}

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
    .select(
      "id, intent, timeline, source, notes, stage, lead_temp, owner_user_id, full_name, first_name, last_name, canonical_email, canonical_phone, raw_email, raw_phone, last_message_preview, next_step, source_detail"
    )
    .or(ownerFilter(auth.context))
    .in("id", [sourceId, targetId]);

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  const source = ((leads || []) as LeadMergeRecord[]).find((lead) => lead.id === sourceId);
  const target = ((leads || []) as LeadMergeRecord[]).find((lead) => lead.id === targetId);
  if (!source || !target) {
    return NextResponse.json({ error: "Source or target lead not found." }, { status: 404 });
  }

  if (!canDeleteOwnedRecord(auth.context, source.owner_user_id)) {
    return NextResponse.json(
      { error: "Role does not allow lead merge for records you do not own." },
      { status: 403 }
    );
  }

  const targetPatch: Record<string, unknown> = {};
  if (!target.intent && source.intent) targetPatch.intent = source.intent;
  if (!target.timeline && source.timeline) targetPatch.timeline = source.timeline;
  if (!target.source && source.source) targetPatch.source = source.source;
  if (!target.full_name && source.full_name) targetPatch.full_name = source.full_name;
  if (!target.first_name && source.first_name) targetPatch.first_name = source.first_name;
  if (!target.last_name && source.last_name) targetPatch.last_name = source.last_name;
  if (!target.canonical_email && source.canonical_email) targetPatch.canonical_email = source.canonical_email;
  if (!target.raw_email && source.raw_email) targetPatch.raw_email = source.raw_email;
  if (!target.canonical_phone && source.canonical_phone) targetPatch.canonical_phone = source.canonical_phone;
  if (!target.raw_phone && source.raw_phone) targetPatch.raw_phone = source.raw_phone;
  if (!target.last_message_preview && source.last_message_preview) {
    targetPatch.last_message_preview = source.last_message_preview;
  }
  if (!target.next_step && source.next_step) targetPatch.next_step = source.next_step;

  if (source.notes) {
    if (!target.notes) {
      targetPatch.notes = source.notes;
    } else if (!target.notes.includes(source.notes)) {
      targetPatch.notes = `${target.notes}\n\nMerged note from duplicate:\n${source.notes}`;
    }
  }

  if (!target.lead_temp && source.lead_temp) targetPatch.lead_temp = source.lead_temp;
  if ((target.stage || "New") === "New" && source.stage && source.stage !== "New") {
    targetPatch.stage = source.stage;
  }

  const targetDetail = sourceDetailObject(target.source_detail);
  const sourceDetail = sourceDetailObject(source.source_detail);
  const mergedDetail: Record<string, unknown> = { ...targetDetail };
  let detailChanged = false;
  for (const [key, sourceValue] of Object.entries(sourceDetail)) {
    if (key === "tags") continue;
    const targetValue = mergedDetail[key];
    const targetText = optionalText(targetValue);
    if ((targetValue === null || targetValue === undefined || targetText === null) && sourceValue !== null && sourceValue !== undefined) {
      mergedDetail[key] = sourceValue;
      detailChanged = true;
    }
  }

  const mergedTags = mergeTags(optionalText(targetDetail.tags), optionalText(sourceDetail.tags));
  if (mergedTags && mergedTags !== optionalText(targetDetail.tags)) {
    mergedDetail.tags = mergedTags;
    detailChanged = true;
  }

  if (detailChanged) {
    targetPatch.source_detail = mergedDetail;
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
