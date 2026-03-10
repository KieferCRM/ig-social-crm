import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  readQuestionnaireFromAgentSettings,
} from "@/lib/questionnaire";

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function parseIntakeAgentId(): string | null {
  return optionalString(process.env.INTAKE_AGENT_ID || null);
}

export async function GET() {
  const intakeAgentId = parseIntakeAgentId();
  if (!intakeAgentId || !isUuid(intakeAgentId)) {
    return NextResponse.json({ config: DEFAULT_QUESTIONNAIRE_CONFIG });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("agents")
    .select("settings")
    .eq("id", intakeAgentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ config: DEFAULT_QUESTIONNAIRE_CONFIG });
  }

  return NextResponse.json({
    config: readQuestionnaireFromAgentSettings(data?.settings || null),
  });
}
