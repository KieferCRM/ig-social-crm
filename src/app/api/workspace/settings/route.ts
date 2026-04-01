import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { loadAccessContext } from "@/lib/access-context";
import {
  mergeWorkspaceSettingsIntoAgentSettings,
  readWorkspaceSettingsFromAgentSettings,
} from "@/lib/workspace-settings";
import { supabaseServer } from "@/lib/supabase/server";

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
    settings: readWorkspaceSettingsFromAgentSettings(data?.settings || null),
  });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Record<string, unknown>>(request, {
    maxBytes: 64 * 1024,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { data: currentRow, error: loadError } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const mergedSettings = mergeWorkspaceSettingsIntoAgentSettings(
    currentRow?.settings || null,
    parsed.data
  );

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
    settings: readWorkspaceSettingsFromAgentSettings(savedRow?.settings || null),
  });
}
