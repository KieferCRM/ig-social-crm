import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { withReminderOwnerColumn } from "@/lib/reminders";

function dueAtFromPreset(preset: string): string {
  const now = new Date();
  if (preset === "1d") return new Date(now.getTime() + 24 * 3600_000).toISOString();
  if (preset === "3d") return new Date(now.getTime() + 3 * 24 * 3600_000).toISOString();
  if (preset === "1w") return new Date(now.getTime() + 7 * 24 * 3600_000).toISOString();
  return new Date(now.getTime() + 24 * 3600_000).toISOString();
}

type CreateReminderBody = {
  lead_id?: string | null;
  conversation_id?: string | null;
  preset?: "1d" | "3d" | "1w";
  due_at?: string;
  note?: string | null;
};

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("follow_up_reminders")
    .select("id, lead_id, conversation_id, due_at, status, note, preset, created_at, updated_at")
    .order("due_at", { ascending: true });

  if (error) {
    console.error("[reminders.get] select failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminders: data || [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsedBody = await parseJsonBody<CreateReminderBody>(request, {
    maxBytes: 16 * 1024,
  });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.data;
  const preset = body.preset || "1d";
  if (!["1d", "3d", "1w"].includes(preset)) {
    return NextResponse.json({ error: "Invalid preset." }, { status: 400 });
  }

  const dueAt = body.due_at || dueAtFromPreset(preset);
  const dueAtDate = new Date(dueAt);
  if (Number.isNaN(dueAtDate.getTime())) {
    return NextResponse.json({ error: "Invalid due_at value." }, { status: 400 });
  }
  const normalizedDueAt = dueAtDate.toISOString();

  if (body.lead_id) {
    const { data: leadAccess, error: leadAccessError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", body.lead_id)
      .or(ownerFilter(auth.context, "owner_user_id"))
      .maybeSingle();

    if (leadAccessError) {
      return NextResponse.json({ error: leadAccessError.message }, { status: 500 });
    }
    if (!leadAccess?.id) {
      return NextResponse.json({ error: "lead_id is not accessible." }, { status: 404 });
    }
  }

  if (body.conversation_id) {
    const { data: conversationAccess, error: conversationAccessError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", body.conversation_id)
      .or(ownerFilter(auth.context))
      .maybeSingle();

    if (conversationAccessError) {
      return NextResponse.json({ error: conversationAccessError.message }, { status: 500 });
    }
    if (!conversationAccess?.id) {
      return NextResponse.json({ error: "conversation_id is not accessible." }, { status: 404 });
    }
  }

  const { data, error } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .insert({
        [ownerColumn]: auth.context.user.id,
        lead_id: body.lead_id || null,
        conversation_id: body.conversation_id || null,
        due_at: normalizedDueAt,
        status: "pending",
        note: body.note || null,
        preset,
      })
      .select("id, lead_id, conversation_id, due_at, status, note, preset, created_at, updated_at")
      .single()
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminder: data });
}
