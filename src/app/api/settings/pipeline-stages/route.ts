import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readPipelineStages, type PipelineStageConfig } from "@/lib/pipeline-settings";
import { OFF_MARKET_STAGES } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agentRow } = await supabaseAdmin()
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const stages = readPipelineStages(agentRow?.settings as Record<string, unknown> | null);
  return NextResponse.json({ stages });
}

export async function PATCH(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { stages?: PipelineStageConfig[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stages = body.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    return NextResponse.json({ error: "stages required" }, { status: 400 });
  }

  // Validate: all values must be valid stage keys
  const validValues = new Set<string>(OFF_MARKET_STAGES);
  for (const s of stages) {
    if (!s.value || !validValues.has(s.value) || !s.label?.trim()) {
      return NextResponse.json({ error: `Invalid stage: ${String(s.value)}` }, { status: 400 });
    }
  }

  const admin = supabaseAdmin();
  const { data: agentRow } = await admin.from("agents").select("settings").eq("id", user.id).maybeSingle();
  const current = (agentRow?.settings as Record<string, unknown>) ?? {};
  const next = { ...current, pipeline_stages: stages };

  const { error } = await admin.from("agents").update({ settings: next }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, stages });
}
