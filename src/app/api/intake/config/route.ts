import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  getBuiltInQuestionnaireConfig,
  normalizeQuestionnaireVariant,
  readQuestionnaireFromAgentSettings,
} from "@/lib/questionnaire";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseIntakeAgentId(): string | null {
  const value = process.env.INTAKE_AGENT_ID || "";
  return value.trim() || null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const variant = normalizeQuestionnaireVariant(url.searchParams.get("variant"));
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const intakeAgentId = parseIntakeAgentId();
    if (!intakeAgentId) {
      return NextResponse.json({
        config: variant ? getBuiltInQuestionnaireConfig(variant) : DEFAULT_QUESTIONNAIRE_CONFIG,
        booking_link: "",
        variant,
      });
    }

    const admin = supabaseAdmin();
    const { data } = await admin.from("agents").select("settings").eq("id", intakeAgentId).maybeSingle();
    const settings = data?.settings || null;

    return NextResponse.json({
      config: variant
        ? getBuiltInQuestionnaireConfig(variant)
        : readQuestionnaireFromAgentSettings(settings),
      booking_link: readWorkspaceSettingsFromAgentSettings(settings).booking_link,
      variant,
    });
  }

  const { data, error } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Keep public intake resilient even if agent settings fetch fails.
    return NextResponse.json({
      config: variant ? getBuiltInQuestionnaireConfig(variant) : DEFAULT_QUESTIONNAIRE_CONFIG,
      booking_link: "",
      variant,
    });
  }

  const settings = data?.settings || null;

  return NextResponse.json({
    config: variant
      ? getBuiltInQuestionnaireConfig(variant)
      : readQuestionnaireFromAgentSettings(settings),
    booking_link: readWorkspaceSettingsFromAgentSettings(settings).booking_link,
    variant,
  });
}
