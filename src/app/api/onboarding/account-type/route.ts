import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { loadAccessContext } from "@/lib/access-context";
import {
  type AccountType,
  mergeOnboardingIntoAgentSettings,
  readOnboardingStateFromAgentSettings,
} from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";

type RequestBody = {
  account_type?: string | null;
};

const ENABLED_ACCOUNT_TYPES: AccountType[] = ["solo_agent", "off_market_agent"];

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const accountType = typeof body.account_type === "string" ? body.account_type.trim() : "";

  if (!accountType) {
    return NextResponse.json({ error: "Select an account type." }, { status: 400 });
  }

  if (accountType === "team_brokerage") {
    return NextResponse.json({ error: "Team/Brokerage is not available yet." }, { status: 400 });
  }

  if (!ENABLED_ACCOUNT_TYPES.includes(accountType as AccountType)) {
    return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
  }

  const { data: agentRow, error: agentError } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const nextSettings = mergeOnboardingIntoAgentSettings(agentRow?.settings || null, {
    ...onboardingState,
    account_type: accountType as AccountType,
    account_type_selected_at: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("agents")
    .update({ settings: nextSettings })
    .eq("id", auth.context.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const telemetryPayload = {
    event_name: "step_complete",
    step: "account_type",
    account_type: accountType,
    status: "saved",
    surface: "api/onboarding/account-type",
    occurred_at: new Date().toISOString(),
  };

  const { error: telemetryError } = await supabase.from("ingestion_events").insert({
    agent_id: auth.context.user.id,
    source: "onboarding",
    external_event_id: `account_type:${auth.context.user.id}:${randomUUID()}`,
    payload_hash: createHash("sha256").update(JSON.stringify(telemetryPayload)).digest("hex"),
    status: "processed",
    attempt_count: 0,
    raw_payload: telemetryPayload,
    processed_at: new Date().toISOString(),
  });

  if (telemetryError) {
    console.warn("[onboarding.account-type] telemetry insert failed", { error: telemetryError.message });
  }

  return NextResponse.json({
    ok: true,
    account_type: accountType,
  });
}
