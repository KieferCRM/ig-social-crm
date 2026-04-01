import { NextResponse } from "next/server";
import { canRunDestructiveAction, loadTeamContext } from "@/lib/team";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadTeamContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.context.teamId) return NextResponse.json({ error: "No active team." }, { status: 400 });

  const body = (await request.json()) as { lead_id?: string; reason?: string };
  const leadId = (body.lead_id || "").trim();
  if (!leadId) return NextResponse.json({ error: "lead_id is required." }, { status: 400 });
  const reason = (body.reason || "").trim();
  if (!reason) return NextResponse.json({ error: "reason is required." }, { status: 400 });

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,team_id,owner_user_id,archived_at")
    .eq("id", leadId)
    .eq("team_id", auth.context.teamId)
    .maybeSingle();
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  if (!canRunDestructiveAction(auth.context, lead.owner_user_id)) {
    return NextResponse.json({ error: "Role cannot archive this lead." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString(), time_last_updated: new Date().toISOString() })
    .eq("id", leadId)
    .eq("team_id", auth.context.teamId)
    .select("id,archived_at,time_last_updated")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("lead_activity_log").insert({
    team_id: auth.context.teamId,
    lead_id: leadId,
    actor_user_id: auth.context.user.id,
    action: "lead_archived",
    metadata: { reason },
  });

  return NextResponse.json({ lead: data });
}
