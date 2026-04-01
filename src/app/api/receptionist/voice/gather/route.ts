/**
 * POST /api/receptionist/voice/gather?s=BASE64_STATE
 *
 * Twilio Gather callback. Called after the caller finishes speaking.
 * Receives SpeechResult, processes the answer, updates state, returns next TwiML question.
 * When all questions are answered, performs the configured call action
 * (transfer, hang up with notification, etc.).
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildTtsPlayUrl } from "@/lib/elevenlabs";
import {
  decodeCallState,
  encodeCallState,
  buildNextQuestion,
  isQualificationComplete,
  type VoiceCallState,
} from "@/app/api/receptionist/voice/inbound/route";
import { upsertReceptionistLead } from "@/lib/receptionist/lead-upsert";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twimlResponse(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`,
    { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } }
  );
}

function sayFallback(message: string): string {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<Say voice="Polly.Joanna">${escaped}</Say>`;
}

function playOrSay(text: string, _voiceId: string, _baseUrl: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<Say voice="Polly.Joanna">${escaped}</Say>`;
}

function resolveBaseUrl(request: Request): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (siteUrl) return siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// Intent extraction from speech
// ---------------------------------------------------------------------------

function extractIntent(speech: string): string | null {
  const lower = speech.toLowerCase();
  // Include common speech-to-text misrecognitions (e.g. "cell" for "sell")
  const sellWords = ["sell", "selling", "cell", "sale", "sales", "list", "listing", "get rid", "offload", "move out", "seller"];
  const buyWords = ["buy", "buying", "purchase", "looking for", "want to buy", "find a home", "new home", "buyer", "looking to buy"];
  const hasSell = sellWords.some((w) => lower.includes(w));
  const hasBuy = buyWords.some((w) => lower.includes(w));
  if (hasSell && hasBuy) return "Buy and Sell";
  if (hasSell) return "Sell";
  if (hasBuy) return "Buy";
  return null;
}

// ---------------------------------------------------------------------------
// Apply a speech answer to the current step
// ---------------------------------------------------------------------------

function applyAnswer(state: VoiceCallState, speech: string): VoiceCallState {
  const next = { ...state };
  const text = speech.trim();

  if (!next.name) {
    // Extract just the first name or full name from the speech
    // "My name is John Smith" → "John Smith"
    const nameMatch = text.match(/(?:i'm|i am|my name is|this is|it's)\s+([A-Za-z ]{2,40})/i);
    next.name = nameMatch ? nameMatch[1].trim() : text.slice(0, 60);
    return next;
  }

  if (!next.intent) {
    const intent = extractIntent(text);
    next.intent = intent ?? text.slice(0, 60);
    next.step = (next.step || 0) + 1;
    return next;
  }

  if (!next.address) {
    next.address = text.slice(0, 200);
    next.step = (next.step || 0) + 1;
    return next;
  }

  if (!next.timeline) {
    next.timeline = text.slice(0, 100);
    next.step = (next.step || 0) + 1;
    return next;
  }

  if (!next.price) {
    next.price = text.slice(0, 100);
    next.step = (next.step || 0) + 1;
    return next;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Upsert lead with all collected data
// ---------------------------------------------------------------------------

async function persistCallAnswers(
  state: VoiceCallState,
  callSid: string
): Promise<string | null> {
  if (!state.agentId || !state.fromPhone) return null;

  const admin = supabaseAdmin();

  const { lead } = await upsertReceptionistLead({
    admin,
    agentId: state.agentId,
    source: "call_inbound",
    values: {
      phone: state.fromPhone,
      full_name: state.name || null,
      intent: state.intent || null,
      timeline: state.timeline || null,
      budget_range: state.price || null,
      location_area: state.address || null,
      source_detail: {
        channel: "phone",
        event: "inbound_call",
        from_phone: state.fromPhone,
        provider_call_id: callSid,
        provider: "twilio",
      },
    },
  });

  return lead?.id ?? null;
}

// ---------------------------------------------------------------------------
// Build closing message based on call handling mode
// ---------------------------------------------------------------------------

function buildClosingMessage(state: VoiceCallState, agentName: string): string {
  const name = state.name ? ` ${state.name}` : "";

  switch (state.callHandlingMode) {
    case "qualify_transfer":
      return `Great, thanks${name}! I've got all your details. Let me transfer you to ${agentName} now. One moment please.`;
    case "always_transfer":
      return `Thanks${name}! Connecting you to ${agentName} now.`;
    case "qualify_callback":
      return `Thanks${name}! I've noted everything. ${agentName} will call you back shortly to discuss next steps. Is there a best time to reach you?`;
    case "always_ai":
    default:
      return `Thanks${name}! I've captured all your information. ${agentName} will be in touch with you very soon. Have a great day!`;
  }
}

// ---------------------------------------------------------------------------
// Transfer TwiML (for qualify_transfer and always_transfer modes)
// ---------------------------------------------------------------------------

function buildTransferTwiml(forwardingPhone: string, fromPhone: string, callSid: string, baseUrl: string, agentId: string): string {
  if (!forwardingPhone) {
    return sayFallback("Unfortunately I could not connect you right now. The agent will call you back shortly.");
  }

  const escaped = forwardingPhone.replace(/&/g, "&amp;");
  const statusUrl = `${baseUrl}/api/receptionist/voice/status?agent_id=${encodeURIComponent(agentId)}`.replace(/&/g, "&amp;");

  return (
    `<Dial action="${statusUrl}" callerId="${escaped.replace(/&/g, "&amp;")}">` +
    `<Number statusCallbackEvent="completed" statusCallback="${statusUrl}">${escaped}</Number>` +
    `</Dial>` +
    // Fallback if transfer fails
    sayFallback("I was unable to connect you. The agent will call you back shortly.")
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const url = new URL(request.url);

  const encodedState = url.searchParams.get("s") || "";
  const state = decodeCallState(encodedState);

  const speechResult = (params.get("SpeechResult") || "").trim();
  const callSid = params.get("CallSid") || "";
  const fromPhone = params.get("From") || "";
  const baseUrl = resolveBaseUrl(request);

  // If state is missing or corrupt, bail gracefully
  if (!state) {
    return twimlResponse(
      sayFallback("I'm sorry, something went wrong. An agent will follow up with you shortly.") +
      "<Hangup />"
    );
  }

  // Merge fromPhone into state if not set (first call)
  if (!state.fromPhone && fromPhone) {
    state.fromPhone = fromPhone;
  }

  const voiceId = state.voiceId;
  const voiceName = state.voiceName || "Sarah";

  // If no speech was captured (caller was silent)
  if (!speechResult) {
    const question = buildNextQuestion(state);
    if (!question) {
      // All done — close out
      return twimlResponse(
        playOrSay(`Thank you for calling! The agent will be in touch soon.`, voiceId, baseUrl) +
        "<Hangup />"
      );
    }

    const nextEncodedState = encodeCallState(state);
    const gatherUrl = `${baseUrl}/api/receptionist/voice/gather?s=${encodeURIComponent(nextEncodedState)}`;

    return twimlResponse(
      `<Gather input="speech" action="${gatherUrl.replace(/&/g, "&amp;")}" timeout="6" speechTimeout="auto" speechModel="phone_call">` +
      playOrSay(`I didn't catch that. ${question}`, voiceId, baseUrl) +
      `</Gather>` +
      `<Redirect method="POST">${gatherUrl.replace(/&/g, "&amp;")}</Redirect>`
    );
  }

  // Apply the speech answer to the state
  const updatedState = applyAnswer(state, speechResult);

  // Persist to database (fire-and-forget for speed — do not await in the hot path)
  void persistCallAnswers(updatedState, callSid).then((leadId) => {
    if (leadId) updatedState.leadId = leadId;
  });

  // Check if qualification is complete
  const complete = isQualificationComplete(updatedState);

  // Load agent name for the closing message
  let agentDisplayName = "the agent";
  if (complete || updatedState.callHandlingMode === "always_transfer") {
    const admin = supabaseAdmin();
    const { data: agentRow } = await admin
      .from("agents")
      .select("full_name")
      .eq("id", state.agentId)
      .maybeSingle();
    agentDisplayName = (agentRow?.full_name as string | null)?.split(" ")[0] || "the agent";
  }

  // Handle always_transfer — transfer immediately after first answer (name)
  if (updatedState.callHandlingMode === "always_transfer" && updatedState.name) {
    const closingMsg = `Thanks ${updatedState.name}! Let me connect you to ${agentDisplayName} right now.`;
    return twimlResponse(
      playOrSay(closingMsg, voiceId, baseUrl) +
      buildTransferTwiml(updatedState.forwardingPhone, fromPhone, callSid, baseUrl, state.agentId)
    );
  }

  // If qualification complete — close out based on mode
  if (complete) {
    const closingMsg = buildClosingMessage(updatedState, agentDisplayName);

    // Persist final answers before closing
    await persistCallAnswers(updatedState, callSid);

    if (updatedState.callHandlingMode === "qualify_transfer") {
      return twimlResponse(
        playOrSay(closingMsg, voiceId, baseUrl) +
        buildTransferTwiml(updatedState.forwardingPhone, fromPhone, callSid, baseUrl, state.agentId)
      );
    }

    // For always_ai and qualify_callback — hang up and let status callback handle post-processing
    return twimlResponse(
      playOrSay(closingMsg, voiceId, baseUrl) +
      `<Hangup />`
    );
  }

  // More questions to ask
  const nextQuestion = buildNextQuestion(updatedState);
  const nextEncodedState = encodeCallState(updatedState);
  const gatherUrl = `${baseUrl}/api/receptionist/voice/gather?s=${encodeURIComponent(nextEncodedState)}`;

  return twimlResponse(
    `<Gather input="speech" action="${gatherUrl.replace(/&/g, "&amp;")}" timeout="6" speechTimeout="auto" speechModel="phone_call">` +
    playOrSay(nextQuestion, voiceId, baseUrl) +
    `</Gather>` +
    `<Redirect method="POST">${gatherUrl.replace(/&/g, "&amp;")}</Redirect>`
  );
}
