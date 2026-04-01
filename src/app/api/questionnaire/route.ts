import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import {
  mergeQuestionnaireIntoAgentSettings,
  readQuestionnaireFromAgentSettings,
  normalizeQuestionnaireConfig,
} from "@/lib/questionnaire";

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    config: readQuestionnaireFromAgentSettings(data?.settings || null),
  });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const rawConfig =
    body && typeof body === "object" && "config" in body
      ? (body as { config: unknown }).config
      : body;
  const nextConfig = normalizeQuestionnaireConfig(rawConfig);

  const { data: currentRow, error: currentError } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  const mergedSettings = mergeQuestionnaireIntoAgentSettings(currentRow?.settings || null, nextConfig);

  const { data: savedRow, error: saveError } = await supabase
    .from("agents")
    .upsert(
      {
        id: auth.context.user.id,
        settings: mergedSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("settings")
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    config: readQuestionnaireFromAgentSettings(savedRow?.settings || null),
  });
}
