import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readGoogleTokens, ensureValidToken, createCalendarEvent, GOOGLE_OAUTH_KEY } from "@/lib/google-calendar";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("appointments")
    .select("*,lead:leads(full_name,canonical_phone),deal:deals(property_address)")
    .eq("agent_id", user.id)
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointments: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const scheduledAt = typeof body.scheduled_at === "string" ? body.scheduled_at : "";
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!scheduledAt) return NextResponse.json({ error: "scheduled_at is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      agent_id:         user.id,
      lead_id:          typeof body.lead_id === "string" ? body.lead_id : null,
      deal_id:          typeof body.deal_id === "string" ? body.deal_id : null,
      title,
      scheduled_at:     scheduledAt,
      duration_minutes: typeof body.duration_minutes === "number" ? body.duration_minutes : 30,
      appointment_type: typeof body.appointment_type === "string" ? body.appointment_type : "call",
      status:           "scheduled",
      location:         typeof body.location === "string" ? body.location.trim() || null : null,
      notes:            typeof body.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*,lead:leads(full_name,canonical_phone),deal:deals(property_address)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort push to Google Calendar if connected
  try {
    const admin = supabaseAdmin();
    const { data: agent } = await admin.from("agents").select("settings").eq("id", user.id).maybeSingle();
    const tokens = readGoogleTokens(agent?.settings);
    if (tokens) {
      const { tokens: validTokens, refreshed } = await ensureValidToken(tokens);
      if (refreshed) {
        const current = (agent?.settings ?? {}) as Record<string, unknown>;
        await admin.from("agents").update({ settings: { ...current, [GOOGLE_OAUTH_KEY]: validTokens } }).eq("id", user.id);
      }
      const durationMs = (data.duration_minutes ?? 30) * 60_000;
      const start = new Date(data.scheduled_at).toISOString();
      const end = new Date(new Date(data.scheduled_at).getTime() + durationMs).toISOString();
      await createCalendarEvent(validTokens, {
        summary: data.title,
        description: data.notes ?? undefined,
        location: data.location ?? undefined,
        start,
        end,
      });
    }
  } catch {
    // non-fatal — appointment was saved, just couldn't push to Google
  }

  return NextResponse.json({ appointment: data });
}
