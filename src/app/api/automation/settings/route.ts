import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

const DEFAULTS = {
  intent_enabled: true,
  intent_question: "What are you looking for exactly (buy/sell/invest)?",
  timeline_enabled: true,
  timeline_question: "What is your ideal timeline to move?",
  budget_range_enabled: true,
  budget_range_question: "What budget range are you targeting?",
  location_area_enabled: true,
  location_area_question: "Which location or neighborhood is best for you?",
  contact_preference_enabled: true,
  contact_preference_question: "How do you prefer we stay in touch?",
  next_step_enabled: true,
  next_step_question: "What is the best next step for you right now?",
  completion_message: "Great, you are qualified. I can help with next steps now.",
};

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("qualification_settings")
    .select("*")
    .or(ownerFilter(auth.context))
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data || { agent_id: auth.context.user.id, ...DEFAULTS },
  });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as Partial<typeof DEFAULTS>;

  const payload = {
    agent_id: auth.context.user.id,
    ...DEFAULTS,
    ...body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("qualification_settings")
    .upsert(payload, { onConflict: "agent_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
