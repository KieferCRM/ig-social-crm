import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type CreateRuleBody = {
  trigger_event?: "lead_created";
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

function cleanDelayHours(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 24;
  return Math.max(1, Math.min(24 * 30, Math.round(n)));
}

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("automation_rules")
    .select("id,trigger_event,enabled,condition_stage,condition_lead_temp,delay_hours,reminder_note,created_at,updated_at")
    .or(ownerFilter(auth.context, "owner_user_id"))
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data || [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as CreateRuleBody;
  const payload = {
    agent_id: auth.context.user.id,
    owner_user_id: auth.context.user.id,
    trigger_event: "lead_created",
    enabled: body.enabled ?? true,
    condition_stage: cleanText(body.condition_stage),
    condition_lead_temp: cleanText(body.condition_lead_temp),
    delay_hours: cleanDelayHours(body.delay_hours),
    reminder_note: cleanText(body.reminder_note),
  };

  const { data, error } = await supabase
    .from("automation_rules")
    .insert(payload)
    .select("id,trigger_event,enabled,condition_stage,condition_lead_temp,delay_hours,reminder_note,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}
