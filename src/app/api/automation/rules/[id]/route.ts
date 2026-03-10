import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type PatchRuleBody = {
  enabled?: boolean;
  condition_stage?: string | null;
  condition_lead_temp?: string | null;
  delay_hours?: number;
  reminder_note?: string | null;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanDelayHours(value: unknown): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(24 * 30, Math.round(n)));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const body = (await request.json()) as PatchRuleBody;

  const patch: Record<string, string | number | boolean | null> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if ("condition_stage" in body) patch.condition_stage = cleanText(body.condition_stage);
  if ("condition_lead_temp" in body) patch.condition_lead_temp = cleanText(body.condition_lead_temp);
  if ("reminder_note" in body) patch.reminder_note = cleanText(body.reminder_note);
  const delay = cleanDelayHours(body.delay_hours);
  if (delay !== null) patch.delay_hours = delay;

  const { data, error } = await supabase
    .from("automation_rules")
    .update(patch)
    .eq("id", id)
    .or(ownerFilter(auth.context, "owner_user_id"))
    .select("id,trigger_event,enabled,condition_stage,condition_lead_temp,delay_hours,reminder_note,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;

  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .or(ownerFilter(auth.context, "owner_user_id"));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
