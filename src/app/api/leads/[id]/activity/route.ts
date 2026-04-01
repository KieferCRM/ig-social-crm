/**
 * GET  /api/leads/[id]/activity  — fetch recent manual interactions for a lead
 * POST /api/leads/[id]/activity  — log a manual call / email / note / meeting
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActivityType = "call" | "email" | "note" | "meeting" | "text";

type PostBody = {
  activity_type: ActivityType;
  note?: string;
};

const ACTIVITY_CHANNEL: Record<ActivityType, string> = {
  call: "call_outbound",
  email: "email",
  note: "note",
  meeting: "meeting",
  text: "sms",
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Called",
  email: "Emailed",
  note: "Note added",
  meeting: "Met in person",
  text: "Texted",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: leadId } = await params;

  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();

  // Verify the lead belongs to this agent
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("agent_id", auth.context.user.id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { data: interactions, error } = await admin
    .from("lead_interactions")
    .select("id, created_at, channel, interaction_type, raw_message_body, summary")
    .eq("lead_id", leadId)
    .eq("agent_id", auth.context.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ interactions: interactions ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: leadId } = await params;

  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<PostBody>(request, { maxBytes: 4096 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { activity_type, note } = parsed.data;

  if (!activity_type || !ACTIVITY_CHANNEL[activity_type]) {
    return NextResponse.json({ error: "Invalid activity_type" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const agentId = auth.context.user.id;

  // Verify lead ownership
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const summary = note?.trim()
    ? `${ACTIVITY_LABEL[activity_type]}: ${note.trim()}`
    : ACTIVITY_LABEL[activity_type];

  const { data: interaction, error } = await admin
    .from("lead_interactions")
    .insert({
      agent_id: agentId,
      lead_id: leadId,
      channel: ACTIVITY_CHANNEL[activity_type],
      direction: "outbound",
      interaction_type: activity_type,
      status: "completed",
      raw_message_body: note?.trim() || null,
      summary,
    })
    .select("id, created_at, channel, interaction_type, raw_message_body, summary")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_communication_at on the lead
  await admin
    .from("leads")
    .update({ last_communication_at: new Date().toISOString() })
    .eq("id", leadId);

  return NextResponse.json({ ok: true, interaction });
}
