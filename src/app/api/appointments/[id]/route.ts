import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.scheduled_at === "string") patch.scheduled_at = body.scheduled_at;
  if (typeof body.duration_minutes === "number") patch.duration_minutes = body.duration_minutes;
  if (typeof body.appointment_type === "string") patch.appointment_type = body.appointment_type;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.location === "string") patch.location = body.location.trim() || null;
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
  if (typeof body.confirmed_by_lead === "boolean") patch.confirmed_by_lead = body.confirmed_by_lead;

  const { data, error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .eq("agent_id", user.id)
    .select("*,lead:leads(full_name,canonical_phone),deal:deals(property_address)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointment: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("agent_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
