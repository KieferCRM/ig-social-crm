import { NextResponse } from "next/server";
import { loadTeamContext } from "@/lib/team";
import { supabaseServer } from "@/lib/supabase/server";

type Priority = "low" | "medium" | "high" | "urgent";
type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadTeamContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.context.teamId) return NextResponse.json({ tasks: [] });

  const url = new URL(request.url);
  const onlyMine = url.searchParams.get("mine") === "1";
  const status = url.searchParams.get("status");

  let query = supabase
    .from("lead_tasks")
    .select("id,lead_id,team_id,owner_user_id,assignee_user_id,title,description,priority,status,due_at,recurrence,source_event,sla_bucket,created_at,updated_at")
    .eq("team_id", auth.context.teamId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(250);

  if (onlyMine) query = query.eq("assignee_user_id", auth.context.user.id);
  if (status && ["open", "in_progress", "done", "cancelled"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadTeamContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.context.teamId) return NextResponse.json({ error: "No active team." }, { status: 400 });

  const body = (await request.json()) as {
    lead_id?: string | null;
    title?: string;
    description?: string | null;
    priority?: Priority;
    status?: TaskStatus;
    due_at?: string | null;
    recurrence?: "none" | "daily" | "weekly" | "monthly" | null;
    assignee_user_id?: string | null;
    source_event?: string | null;
  };

  const title = (body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  const priority = body.priority || "medium";
  const status = body.status || "open";
  if (!["low", "medium", "high", "urgent"].includes(priority)) {
    return NextResponse.json({ error: "Invalid task priority." }, { status: 400 });
  }
  if (!["open", "in_progress", "done", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid task status." }, { status: 400 });
  }

  const dueAtIso = body.due_at || null;
  const slaBucket =
    dueAtIso && new Date(dueAtIso).getTime() < Date.now()
      ? "overdue"
      : dueAtIso && new Date(dueAtIso).getTime() < Date.now() + 24 * 3600_000
        ? "due_24h"
        : "normal";

  const { data, error } = await supabase
    .from("lead_tasks")
    .insert({
      lead_id: body.lead_id || null,
      team_id: auth.context.teamId,
      owner_user_id: auth.context.user.id,
      assignee_user_id: body.assignee_user_id || auth.context.user.id,
      title,
      description: (body.description || "").trim() || null,
      priority,
      status,
      due_at: dueAtIso,
      recurrence: body.recurrence || "none",
      source_event: (body.source_event || "").trim() || null,
      sla_bucket: slaBucket,
    })
    .select("id,lead_id,team_id,owner_user_id,assignee_user_id,title,description,priority,status,due_at,recurrence,source_event,sla_bucket,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data.lead_id) {
    await supabase.from("lead_activity_log").insert({
      team_id: auth.context.teamId,
      lead_id: data.lead_id,
      actor_user_id: auth.context.user.id,
      action: "task_created",
      metadata: { task_id: data.id, due_at: data.due_at, assignee_user_id: data.assignee_user_id },
    });
  }

  return NextResponse.json({ task: data });
}
