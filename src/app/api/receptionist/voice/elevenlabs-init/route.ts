/**
 * POST /api/receptionist/voice/elevenlabs-init
 *
 * ElevenLabs pre-call webhook. Called at the START of each phone call before
 * the agent speaks. We return dynamic variables so the AI knows who it's
 * working for (agent name, AI name, etc.).
 *
 * Configure this URL in ElevenLabs → Agent → Advanced → "Pre-call webhook URL"
 *
 * ElevenLabs sends:
 *   { agent_id, called_number, caller_number }
 *
 * We respond with:
 *   { dynamic_variables: { agent_name, agent_first_name, ai_name } }
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readReceptionistSettingsFromAgentSettings, getCallInstructions } from "@/lib/receptionist/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InitPayload = {
  agent_id?: string;
  called_number?: string;   // the business number that was called
  caller_number?: string;   // the caller's number
  // ElevenLabs may use different field names — handle variations
  to?: string;
  from?: string;
  phone_number?: string;
  [key: string]: unknown;
};

async function loadActiveListings(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string
): Promise<string> {
  const { data } = await admin
    .from("deals")
    .select("property_address, stage")
    .eq("agent_id", agentId)
    .not("stage", "in", "(closed,dead)")
    .limit(10);

  if (!data || data.length === 0) return "none";

  return data
    .map((d) => d.property_address as string | null)
    .filter(Boolean)
    .join(", ") || "none";
}

async function findAgentByPhone(
  admin: ReturnType<typeof supabaseAdmin>,
  calledNumber: string | null
): Promise<{ agentId: string; fullName: string; voiceName: string; callMode: string } | null> {
  if (!calledNumber) return null;

  const digits = (s: string) => s.replace(/\D/g, "");
  const normalizedDigits = digits(calledNumber);

  const { data: rows } = await admin
    .from("agents")
    .select("id, full_name, settings")
    .not("settings", "is", null);

  if (!rows) return null;

  for (const row of rows) {
    const settings = readReceptionistSettingsFromAgentSettings(row.settings);
    const bizDigits = digits(settings.business_phone_number);
    if (bizDigits && bizDigits.slice(-10) === normalizedDigits.slice(-10)) {
      return {
        agentId: row.id as string,
        fullName: (row.full_name as string | null) || "your agent",
        voiceName: settings.voice_name || "Sarah",
        callMode: settings.call_handling_mode,
      };
    }
  }

  return null;
}

async function findAgentByElevenLabsId(
  admin: ReturnType<typeof supabaseAdmin>,
  elevenLabsAgentId: string
): Promise<{ agentId: string; fullName: string; voiceName: string; callMode: string } | null> {
  const { data: rows } = await admin
    .from("agents")
    .select("id, full_name, settings")
    .not("settings", "is", null);

  if (!rows) return null;

  for (const row of rows) {
    const settings = readReceptionistSettingsFromAgentSettings(row.settings);
    if (settings.voice_agent_id && settings.voice_agent_id === elevenLabsAgentId) {
      return {
        agentId: row.id as string,
        fullName: (row.full_name as string | null) || "your agent",
        voiceName: settings.voice_name || "Sarah",
        callMode: settings.call_handling_mode,
      };
    }
  }

  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: InitPayload;
  try {
    const body = await request.text();
    payload = JSON.parse(body) as InitPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log so we can see the exact field names ElevenLabs sends
  console.log("[elevenlabs-init] Pre-call payload:", JSON.stringify(payload));

  const calledNumber =
    (payload.called_number as string | undefined) ||
    (payload.to as string | undefined) ||
    (payload.phone_number as string | undefined) ||
    null;

  const admin = supabaseAdmin();

  // Try matching by the called phone number first, then by ElevenLabs agent ID
  let match =
    (calledNumber ? await findAgentByPhone(admin, calledNumber) : null) ??
    (payload.agent_id ? await findAgentByElevenLabsId(admin, payload.agent_id) : null);

  // Fallback variables if we can't find the agent
  if (!match) {
    console.warn("[elevenlabs-init] No agent matched for called_number:", calledNumber, "agent_id:", payload.agent_id);
    match = { agentId: "", fullName: "your agent", voiceName: "Sarah", callMode: "qualify_callback" };
  } else {
    console.log("[elevenlabs-init] Matched agent:", match.agentId, match.fullName, "mode:", match.callMode);
  }

  const firstName = match.fullName.split(" ")[0] || match.fullName;

  const activeListings = match.agentId
    ? await loadActiveListings(admin, match.agentId)
    : "none";

  // Build call_instructions from mode — append active listings if any
  let callInstructions = getCallInstructions(
    match.callMode as Parameters<typeof getCallInstructions>[0],
    firstName
  );
  if (activeListings && activeListings !== "none") {
    callInstructions += `\n\nActive listings you are aware of: ${activeListings}. If a caller mentions a specific property, house, or listing, do not ask if they want to buy or sell — ask which property they're calling about if it's unclear, then move on.`;
  }

  return NextResponse.json({
    dynamic_variables: {
      agent_name: match.fullName,
      agent_first_name: firstName,
      ai_name: match.voiceName,
      call_instructions: callInstructions,
    },
  });
}
