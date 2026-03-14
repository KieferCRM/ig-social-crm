import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  readQuestionnaireFromAgentSettings,
} from "@/lib/questionnaire";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ config: DEFAULT_QUESTIONNAIRE_CONFIG });
  }

  const { data, error } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Keep public intake resilient even if agent settings fetch fails.
    return NextResponse.json({ config: DEFAULT_QUESTIONNAIRE_CONFIG });
  }

  return NextResponse.json({
    config: readQuestionnaireFromAgentSettings(data?.settings || null),
  });
}
