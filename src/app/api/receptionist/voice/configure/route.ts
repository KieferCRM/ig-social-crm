/**
 * POST /api/receptionist/voice/configure
 *
 * Authenticated. Creates or updates the ElevenLabs Conversational AI agent
 * for this agent's Secretary Voice setup.
 *
 * Stores the resulting agent_id in agents.settings.receptionist_settings.voice_agent_id.
 * Once set, inbound calls stream directly to ElevenLabs (Mode A) instead of using
 * the sequential TTS+Gather flow.
 *
 * Body: {} (uses current settings to build the agent config)
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  readReceptionistSettingsFromAgentSettings,
  mergeReceptionistIntoAgentSettings,
  activeVoiceId,
} from "@/lib/receptionist/settings";
import {
  elevenLabsApiKey,
  createConversationalAgent,
  updateConversationalAgent,
  buildAgentSystemPrompt,
  buildFirstMessage,
} from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!elevenLabsApiKey()) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured on this server." },
      { status: 503 }
    );
  }

  const agentId = auth.context.user.id;
  const admin = supabaseAdmin();

  const { data: agentRow } = await admin
    .from("agents")
    .select("full_name, settings")
    .eq("id", agentId)
    .maybeSingle();

  if (!agentRow) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const settings = readReceptionistSettingsFromAgentSettings(agentRow.settings);
  const agentDisplayName = (agentRow.full_name as string | null)?.trim() || "";
  const voiceId = activeVoiceId(settings);
  const voiceName = settings.voice_name || "Sarah";

  const systemPrompt = buildAgentSystemPrompt({
    voiceName,
    agentName: agentDisplayName,
    agencyName: "",
    callHandlingMode: settings.call_handling_mode,
    existingLeadContext: null,
  });

  const firstMessage = buildFirstMessage(voiceName, agentDisplayName);

  let result;
  if (settings.voice_agent_id) {
    // Update existing agent
    result = await updateConversationalAgent(settings.voice_agent_id, {
      agentName: `LockboxHQ — ${agentDisplayName || agentId}`,
      voiceName,
      voiceId,
      systemPrompt,
      firstMessage,
    });
  } else {
    // Create new agent
    result = await createConversationalAgent({
      agentName: `LockboxHQ — ${agentDisplayName || agentId}`,
      voiceName,
      voiceId,
      systemPrompt,
      firstMessage,
    });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Store the agent ID in settings
  const updatedSettings = mergeReceptionistIntoAgentSettings(agentRow.settings, {
    voice_agent_id: result.agentId,
  });

  await admin.from("agents").update({ settings: updatedSettings }).eq("id", agentId);

  return NextResponse.json({
    ok: true,
    agent_id: result.agentId,
  });
}
