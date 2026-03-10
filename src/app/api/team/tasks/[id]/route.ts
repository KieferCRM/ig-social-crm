import { NextResponse } from "next/server";
import { canRunDestructiveAction, loadTeamContext } from "@/lib/team";
import { supabaseServer } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadTeamContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.context.teamId) return NextResponse.json({ error: "No active team." }, { status: 400 });

  const body = (await request.json()) as {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high" | "urgent";
    status?: "open" | "in_progress" | "done" | "cancelled";
    due_at?: string | null;
    recurrence?: "none" | "daily" | "weekly" | "monthly";
    assignee_user_id?: string | null;
  };

  const patch: Record<string, string | null> = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined) patch.description = (body.description || "").trim() || null;
  if (body.priority !== undefined) patch.priority = body.priority;
  if (body.status !== undefined) patch.status = body.status;
  if (body.due_at !== undefined) patch.due_at = body.due_at;
  if (body.recurrence !== undefined) patch.recurrence = body.recurrence;
  if (body.assignee_user_id !== undefined) patch.assignee_user_id = body.assignee_user_id;

  const { data, error } = await supabase
    .from("lead_tasks")
    .update(patch)
    .eq("id", id)
    .eq("team_id", auth.context.teamId)
    .select("id,lead_id,team_id,owner_user_id,assignee_user_id,title,description,priority,status,due_at,recurrence,source_event,sla_bucket,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data.lead_id) {
    await supabase.from("lead_activity_log").insert({
      team_id: auth.context.teamId,
      lead_id: data.lead_id,
      actor_user_id: auth.context.user.id,
      action: "task_updated",
      metadata: { task_id: data.id, status: data.status, assignee_user_id: data.assignee_user_id },
    });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadTeamContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.context.teamId) return NextResponse.json({ error: "No active team." }, { status: 400 });

  const { data: task, error: fetchError } = await supabase
    .from("lead_tasks")
    .select("id,lead_id,owner_user_id")
    .eq("id", id)
    .eq("team_id", auth.context.teamId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (!canRunDestructiveAction(auth.context, task.owner_user_id)) {
    return NextResponse.json({ error: "Role cannot delete this task." }, { status: 403 });
  }

  const { error } = await supabase.from("lead_tasks").delete().eq("id", id).eq("team_id", auth.context.teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (task.lead_id) {
    await supabase.from("lead_activity_log").insert({
      team_id: auth.context.teamId,
      lead_id: task.lead_id,
      actor_user_id: auth.context.user.id,
      action: "task_deleted",
      metadata: { task_id: task.id },
    });
  }

  return NextResponse.json({ ok: true });
}
