/**
 * POST /api/receptionist/voice/inbound?agent_id=UUID
 *
 * Twilio inbound call webhook. Returns TwiML that either:
 *   A) Streams audio directly to ElevenLabs Conversational AI (if agent_id configured), or
 *   B) Uses ElevenLabs TTS + Twilio Gather for sequential qualification Q&A.
 *
 * Configure this URL as the "A Call Comes In" webhook on the Twilio phone number.
 * Include ?agent_id=AGENT_UUID so we can look up the right settings.
 *
 * Status callback URL should be: /api/receptionist/voice/status?agent_id=UUID
 */
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readReceptionistSettingsFromAgentSettings, isVoiceEnabled, activeVoiceId } from "@/lib/receptionist/settings";
import { buildTtsPlayUrl, getConversationalAgentStreamUrl } from "@/lib/elevenlabs";
import { upsertReceptionistLead } from "@/lib/receptionist/lead-upsert";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Twilio signature verification
// ---------------------------------------------------------------------------

function twilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function computeTwilioSignature(url: string, params: URLSearchParams, authToken: string): string {
  const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  let payload = url;
  for (const [k, v] of sorted) payload += `${k}${v}`;
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

function verifyTwilioSignature(request: Request, params: URLSearchParams): boolean {
  const authToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!authToken) return true; // allow in dev/mock mode

  const sig = (request.headers.get("x-twilio-signature") || "").trim();
  if (!sig) return false;

  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedProto) url.protocol = `${forwardedProto.split(",")[0].trim()}:`;
  if (forwardedHost) url.host = forwardedHost.split(",")[0].trim();

  const expected = computeTwilioSignature(url.toString(), params, authToken);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// TwiML helpers
// ---------------------------------------------------------------------------

function twimlResponse(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`,
    {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    }
  );
}

function sayFallback(message: string): string {
  // Plain Twilio <Say> for when ElevenLabs is unavailable
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<Say voice="Polly.Joanna">${escaped}</Say>`;
}

function playOrSay(text: string, voiceId: string, baseUrl: string): string {
  const playUrl = buildTtsPlayUrl(text, voiceId, baseUrl);
  const escapedUrl = playUrl.replace(/&/g, "&amp;");
  return `<Play>${escapedUrl}</Play>`;
}

// ---------------------------------------------------------------------------
// Call state encoding
// Lightweight state passed in gather action URLs so we don't need a DB per step.
// ---------------------------------------------------------------------------

export type VoiceCallState = {
  agentId: string;
  step: number;
  voiceId: string;
  voiceName: string;
  callHandlingMode: string;
  forwardingPhone: string;
  name?: string;
  intent?: string;
  address?: string;
  timeline?: string;
  price?: string;
  leadId?: string;
  fromPhone?: string;
};

export function encodeCallState(state: VoiceCallState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeCallState(encoded: string): VoiceCallState | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    return JSON.parse(decoded) as VoiceCallState;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Inbound call handler
// ---------------------------------------------------------------------------

function resolveBaseUrl(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}

export async function POST(request: Request): Promise<Response> {
  // Parse form-encoded Twilio body
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const agentIdFromQuery = new URL(request.url).searchParams.get("agent_id") || "";
  const agentId = agentIdFromQuery.trim() || (process.env.INTAKE_AGENT_ID || "").trim();

  if (!agentId) {
    return twimlResponse(sayFallback(
      "Thank you for calling. Our team is unavailable right now but will follow up with you shortly."
    ));
  }

  const callSid = params.get("CallSid") || "";
  const fromPhone = params.get("From") || "";
  const toPhone = params.get("To") || "";

  // Verify Twilio signature (pass if no auth token configured — dev mode)
  if (!verifyTwilioSignature(request, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = supabaseAdmin();
  const baseUrl = resolveBaseUrl(request);

  // Load agent settings
  const { data: agentRow } = await admin
    .from("agents")
    .select("id, full_name, settings")
    .eq("id", agentId)
    .maybeSingle();

  if (!agentRow) {
    return twimlResponse(sayFallback(
      "Thank you for calling. The team will follow up with you shortly."
    ));
  }

  const settings = readReceptionistSettingsFromAgentSettings(agentRow.settings);
  const agentDisplayName = (agentRow.full_name as string | null) || "the team";

  // If voice is not enabled, fall through to SMS textback behavior only
  if (!isVoiceEnabled(settings)) {
    const friendlyMessage =
      `Hi, thanks for calling ${agentDisplayName}. We are not available to take your call right now but we will follow up with you as soon as possible. Please leave a message after the tone.`;
    return twimlResponse(
      sayFallback(friendlyMessage) +
      `<Record action="/api/receptionist/voice/status?agent_id=${encodeURIComponent(agentId)}&mode=voicemail" maxLength="120" />`
    );
  }

  const voiceId = activeVoiceId(settings);
  const voiceName = settings.voice_name || "Sarah";

  // ---
  // Mode A: ElevenLabs Conversational AI streaming (if agent has a configured agent_id)
  // ---
  if (settings.voice_agent_id) {
    const streamUrl = await getConversationalAgentStreamUrl(settings.voice_agent_id);
    if (streamUrl) {
      const escapedUrl = streamUrl.replace(/&/g, "&amp;");
      return twimlResponse(
        `<Connect>` +
        `<Stream url="${escapedUrl}" track="both_tracks" />` +
        `</Connect>` +
        // Fallback if stream fails
        sayFallback(`Thank you for calling. ${voiceName} will connect with you shortly.`)
      );
    }
  }

  // ---
  // Mode B: Sequential TTS + Twilio Gather qualification flow
  // ---

  // Look up existing lead to skip known questions
  let existingLeadId: string | undefined;
  let existingName: string | undefined;
  let existingIntent: string | undefined;
  let existingTimeline: string | undefined;

  if (fromPhone) {
    const { lead } = await upsertReceptionistLead({
      admin,
      agentId,
      source: "call_inbound",
      values: {
        phone: fromPhone,
        source_detail: {
          channel: "phone",
          event: "inbound_call",
          from_phone: fromPhone,
          to_phone: toPhone || null,
          provider: "twilio",
        },
      },
    });
    if (lead) {
      existingLeadId = lead.id;
      existingName = (lead.full_name || lead.first_name || "").trim() || undefined;
      existingIntent = (lead.intent || "").trim() || undefined;
      existingTimeline = (lead.timeline || "").trim() || undefined;
    }
  }

  // Build initial call state
  const initialState: VoiceCallState = {
    agentId,
    step: 0,
    voiceId,
    voiceName,
    callHandlingMode: settings.call_handling_mode,
    forwardingPhone: settings.forwarding_phone_number,
    name: existingName,
    intent: existingIntent,
    timeline: existingTimeline,
    leadId: existingLeadId,
    fromPhone: fromPhone || undefined,
  };

  // Greeting message
  const greeting = `Hi, thanks for calling ${agentDisplayName}! I'm ${voiceName}, the AI assistant. I have a few quick questions to make sure the agent can help you right away.`;
  const encodedState = encodeCallState(initialState);
  const gatherUrl = `${baseUrl}/api/receptionist/voice/gather?s=${encodeURIComponent(encodedState)}`;

  // Determine first question (skip known fields)
  const firstQuestion = buildNextQuestion(initialState);

  const twiml = [
    playOrSay(greeting, voiceId, baseUrl),
    `<Gather input="speech" action="${gatherUrl.replace(/&/g, "&amp;")}" timeout="6" speechTimeout="auto" speechModel="phone_call">`,
    playOrSay(firstQuestion, voiceId, baseUrl),
    `</Gather>`,
    // If no speech, redirect to gather so the question repeats once
    `<Redirect method="POST">${gatherUrl.replace(/&/g, "&amp;")}</Redirect>`,
  ].join("\n");

  return twimlResponse(twiml);
}

// ---------------------------------------------------------------------------
// Qualification question logic (shared with gather route)
// ---------------------------------------------------------------------------

export const QUALIFICATION_STEPS = ["name", "intent", "address", "timeline", "price"] as const;

export function buildNextQuestion(state: VoiceCallState): string {
  if (!state.name) return "Can I start by getting your name?";

  if (!state.intent) {
    return `Thanks ${state.name}! Are you looking to buy or sell a property, or maybe both?`;
  }

  const isSeller = state.intent.toLowerCase().includes("sell");
  if (!state.address) {
    return isSeller
      ? "What's the address of the property you're looking to sell?"
      : "Great! What area or neighborhood are you looking to buy in?";
  }

  if (!state.timeline) {
    return isSeller
      ? "And what's your timeline — when are you hoping to have this property sold?"
      : "What's your timeline — when are you hoping to be in your new home?";
  }

  if (!state.price) {
    return isSeller
      ? "What's your asking price or the price range you're hoping to get?"
      : "What's your budget for the purchase?";
  }

  // All questions answered
  return "";
}

export function isQualificationComplete(state: VoiceCallState): boolean {
  return !!(state.name && state.intent && state.address && state.timeline && state.price);
}
