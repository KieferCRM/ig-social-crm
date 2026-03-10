import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type AppointmentStatus = "booked" | "no_show" | "won" | "lost" | "other";

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const leadId = url.searchParams.get("lead_id");

  let query = supabase
    .from("lead_appointments")
    .select("id, lead_id, status, event_at, note, created_at")
    .or(ownerFilter(auth.context))
    .order("event_at", { ascending: false })
    .limit(100);

  if (leadId) {
    query = query.eq("lead_id", leadId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({
        appointments: [],
        warning: "lead_appointments table not found. Run step14 SQL migration.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: data || [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as {
    lead_id?: string;
    status?: AppointmentStatus;
    event_at?: string;
    note?: string;
  };

  const leadId = body.lead_id || "";
  const status = body.status || "other";
  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required." }, { status: 400 });
  }
  if (!["booked", "no_show", "won", "lost", "other"].includes(status)) {
    return NextResponse.json({ error: "Invalid appointment status." }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .or(ownerFilter(auth.context))
    .maybeSingle();

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const eventAt = body.event_at || new Date().toISOString();

  const { data, error } = await supabase
    .from("lead_appointments")
    .insert({
      agent_id: auth.context.user.id,
      lead_id: leadId,
      status,
      event_at: eventAt,
      note: (body.note || "").trim() || null,
    })
    .select("id, lead_id, status, event_at, note, created_at")
    .single();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "lead_appointments table not found. Run step14 SQL migration." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointment: data });
}
