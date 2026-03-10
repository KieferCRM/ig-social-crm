import { NextResponse } from "next/server";
import { loadTeamContext } from "@/lib/team";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadTeamContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.context.teamId) return NextResponse.json({ error: "No active team." }, { status: 400 });

  const body = (await request.json()) as {
    lead_id?: string;
    owner_user_id?: string | null;
    assignee_user_id?: string | null;
    visibility?: "private" | "team_visible" | "broker_visible";
    flow_type?: "buyer" | "listing" | "lease";
  };

  const leadId = (body.lead_id || "").trim();
  if (!leadId) return NextResponse.json({ error: "lead_id is required." }, { status: 400 });

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,team_id,owner_user_id,assignee_user_id,visibility,flow_type")
    .eq("id", leadId)
    .eq("team_id", auth.context.teamId)
    .maybeSingle();
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found in active team." }, { status: 404 });

  const privileged = auth.context.role && ["team_lead", "admin", "broker_owner"].includes(auth.context.role);
  if (!privileged && lead.owner_user_id !== auth.context.user.id) {
    return NextResponse.json({ error: "Only owner or lead/admin can assign this lead." }, { status: 403 });
  }

  const patch: Record<string, string | null> = {
    time_last_updated: new Date().toISOString(),
  };
  if (body.owner_user_id !== undefined) patch.owner_user_id = body.owner_user_id || null;
  if (body.assignee_user_id !== undefined) patch.assignee_user_id = body.assignee_user_id || null;
  if (body.visibility !== undefined) patch.visibility = body.visibility;
  if (body.flow_type !== undefined) patch.flow_type = body.flow_type;

  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("team_id", auth.context.teamId)
    .select("id,owner_user_id,assignee_user_id,visibility,flow_type,time_last_updated")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("lead_activity_log").insert({
    team_id: auth.context.teamId,
    lead_id: leadId,
    actor_user_id: auth.context.user.id,
    action: "lead_assignment_updated",
    metadata: {
      before: {
        owner_user_id: lead.owner_user_id,
        assignee_user_id: lead.assignee_user_id,
        visibility: lead.visibility,
        flow_type: lead.flow_type,
      },
      after: data,
    },
  });

  return NextResponse.json({ lead: data });
}
