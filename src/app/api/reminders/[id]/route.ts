import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsedBody = await parseJsonBody<{
    status?: "pending" | "done";
    due_at?: string;
    note?: string | null;
  }>(request, { maxBytes: 16 * 1024 });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.data;

  const update: Record<string, string | null> = {};
  if (body.status) {
    if (!["pending", "done"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.due_at) {
    const dueAt = new Date(body.due_at);
    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: "Invalid due_at value." }, { status: 400 });
    }
    update.due_at = dueAt.toISOString();
  }
  if (body.note !== undefined) update.note = body.note;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("follow_up_reminders")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("follow_up_reminders")
    .update(update)
    .eq("id", id)
    .select("id, lead_id, conversation_id, due_at, status, note, preset, created_at, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[reminders.patch] update failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  return NextResponse.json({ reminder: data });
}
