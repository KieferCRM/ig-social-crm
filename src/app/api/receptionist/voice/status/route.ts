/**
 * POST /api/receptionist/voice/status?agent_id=UUID
 *
 * Twilio call status callback. Called when a call ends (or when a <Dial> completes).
 * Handles post-call CRM updates:
 *  - Upserts the lead with all collected info
 *  - Runs urgency scoring on the transcript
 *  - Creates/updates off-market deals
 *  - Sends the agent an SMS notification summary
 *  - Logs the voice interaction to lead_interactions
 *
 * Also handles voicemail recordings when mode=voicemail is in the query string.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processInboundCallLog, notifyAgentFormSubmission } from "@/lib/receptionist/service";
import { fetchConversationTranscript } from "@/lib/elevenlabs";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed || null;
}

function twimlOk(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response />`,
    { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } }
  );
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text().catch(() => "");
  const params = new URLSearchParams(rawBody);
  const url = new URL(request.url);

  const agentId =
    optStr(url.searchParams.get("agent_id")) ||
    optStr(process.env.INTAKE_AGENT_ID) ||
    null;

  if (!agentId) {
    console.warn("[voice/status] No agent_id — skipping post-call processing.");
    return twimlOk();
  }

  const callSid = optStr(params.get("CallSid")) || "";
  const callStatus = optStr(params.get("CallStatus")) || optStr(params.get("DialCallStatus")) || "completed";
  const fromPhone = optStr(params.get("From")) || optStr(params.get("Called")) || "";
  const toPhone = optStr(params.get("To")) || optStr(params.get("Caller")) || "";
  const recordingUrl = optStr(params.get("RecordingUrl"));
  const recordingDuration = optStr(params.get("RecordingDuration"));
  const isVoicemail = url.searchParams.get("mode") === "voicemail";

  const admin = supabaseAdmin();

  // Fetch agent settings for display name and notification phone
  const { data: agentRow } = await admin
    .from("agents")
    .select("full_name, settings")
    .eq("id", agentId)
    .maybeSingle();

  const settings = readReceptionistSettingsFromAgentSettings(agentRow?.settings ?? null);
  const agentDisplayName = optStr(agentRow?.full_name as string | null) || "the agent";

  // Build transcript from ElevenLabs Conversational AI if a conversation_id was provided
  let transcript: string | null = null;
  const elevenLabsConvId = optStr(url.searchParams.get("conv_id"));
  if (elevenLabsConvId) {
    const conv = await fetchConversationTranscript(elevenLabsConvId);
    if (conv?.transcript) transcript = conv.transcript;
  }

  // Voicemail path — just log the recording and notify
  if (isVoicemail && fromPhone) {
    const vmNote = recordingUrl
      ? `Voicemail received. Recording: ${recordingUrl}${recordingDuration ? ` (${recordingDuration}s)` : ""}`
      : "Voicemail received — no recording URL available.";

    await processInboundCallLog({
      admin,
      agentId,
      fromPhone,
      toPhone: toPhone || null,
      callStatus: "completed",
      transcript: vmNote,
      providerCallId: callSid || null,
      provider: "twilio",
    });

    await notifyAgentFormSubmission(admin, agentId, {
      leadName: null,
      phone: fromPhone,
      formLabel: "voice call",
      details: `Voicemail left. ${recordingUrl ? `Recording: ${recordingUrl}` : ""}`,
    });

    return twimlOk();
  }

  // Standard voice AI call — process transcript + collected data
  if (!fromPhone) {
    console.warn("[voice/status] No From phone — skipping lead processing.");
    return twimlOk();
  }

  // processInboundCallLog handles: lead upsert, urgency scoring, off-market deal, interaction logging, urgent alerts
  const result = await processInboundCallLog({
    admin,
    agentId,
    fromPhone,
    toPhone: toPhone || null,
    callStatus,
    transcript: transcript || null,
    providerCallId: callSid || null,
    provider: "twilio",
  }).catch((err: unknown) => {
    console.error("[voice/status] processInboundCallLog failed:", err);
    return null;
  });

  if (!result) return twimlOk();

  // Fetch the lead to build a rich notification
  const { data: lead } = await admin
    .from("leads")
    .select("full_name, first_name, canonical_phone, intent, timeline, budget, lead_temp, location_area")
    .eq("id", result.leadId)
    .maybeSingle();

  const leadName = optStr(lead?.full_name as string | null) ||
    optStr(lead?.first_name as string | null) ||
    optStr(lead?.canonical_phone as string | null) ||
    "Unknown caller";
  const leadTemp = optStr(lead?.lead_temp as string | null) || "Unclassified";
  const intent = optStr(lead?.intent as string | null);
  const timeline = optStr(lead?.timeline as string | null);
  const budget = optStr(lead?.budget as string | null);
  const area = optStr(lead?.location_area as string | null);

  // Build notification details line
  const detailParts: string[] = [];
  if (intent) detailParts.push(`Intent: ${intent}`);
  if (area) detailParts.push(`Area: ${area}`);
  if (timeline) detailParts.push(`Timeline: ${timeline}`);
  if (budget) detailParts.push(`Price: ${budget}`);
  detailParts.push(`Temp: ${leadTemp}`);

  const details = detailParts.join(" · ") +
    (transcript ? ` | Transcript logged in CRM.` : "");

  // Notify the agent via SMS + in-app alert
  await notifyAgentFormSubmission(admin, agentId, {
    leadName,
    phone: fromPhone,
    formLabel: "voice call",
    details,
  });

  // Flag the lead with voice call received timestamp
  // First fetch existing custom_fields to merge safely
  const { data: leadForPatch } = await admin
    .from("leads")
    .select("custom_fields")
    .eq("id", result.leadId)
    .maybeSingle();
  const existingCustomFields =
    leadForPatch?.custom_fields && typeof leadForPatch.custom_fields === "object" && !Array.isArray(leadForPatch.custom_fields)
      ? (leadForPatch.custom_fields as Record<string, unknown>)
      : {};
  await admin
    .from("leads")
    .update({
      custom_fields: {
        ...existingCustomFields,
        voice_call_received: true,
        voice_call_received_at: new Date().toISOString(),
      },
      time_last_updated: new Date().toISOString(),
    })
    .eq("id", result.leadId);

  return twimlOk();
}
