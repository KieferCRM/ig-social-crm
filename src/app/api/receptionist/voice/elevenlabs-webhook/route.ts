/**
 * POST /api/receptionist/voice/elevenlabs-webhook
 *
 * ElevenLabs post-call webhook. Receives transcript + analysis after each call ends.
 * Parses caller info from the transcript and saves/updates the lead in the CRM.
 *
 * Configure this URL in ElevenLabs → Settings → Webhooks (workspace level).
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { upsertReceptionistLead } from "@/lib/receptionist/lead-upsert";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TranscriptTurn = {
  role: "agent" | "user";
  message: string;
  time_in_call_secs?: number;
};

type WebhookPayload = {
  type: string;
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    transcript: TranscriptTurn[];
    metadata?: {
      start_time_unix_secs?: number;
      call_duration_secs?: number;
      phone_number?: string;
      caller_id?: string;
      [key: string]: unknown;
    };
    analysis?: {
      transcript_summary?: string;
      data_collection_results?: Record<string, { value?: string; [key: string]: unknown }>;
      call_successful?: string;
    };
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, string>;
      [key: string]: unknown;
    };
  };
};

// ---------------------------------------------------------------------------
// Extract lead fields from transcript
// ---------------------------------------------------------------------------

function extractFromTranscript(transcript: TranscriptTurn[]): {
  name?: string;
  phone?: string;
  intent?: string;
  address?: string;
  timeline?: string;
  budget?: string;
} {
  const userLines = transcript
    .filter((t) => t.role === "user")
    .map((t) => t.message.trim())
    .join(" ");

  const allLines = transcript.map((t) => `${t.role}: ${t.message}`).join("\n");

  // Name — look for agent asking for name followed by user response
  let name: string | undefined;
  for (let i = 0; i < transcript.length - 1; i++) {
    const turn = transcript[i];
    const next = transcript[i + 1];
    if (
      turn.role === "agent" &&
      /name/i.test(turn.message) &&
      next.role === "user" &&
      next.message.trim().length > 0
    ) {
      const raw = next.message.trim();
      const match = raw.match(/(?:i'm|i am|my name is|this is|it's|its)\s+([A-Za-z ]{2,50})/i);
      name = match ? match[1].trim() : raw.slice(0, 60);
      break;
    }
  }

  // Intent
  let intent: string | undefined;
  const lower = userLines.toLowerCase();
  const hasSell = /\b(sell|selling|sale|list|listing)\b/.test(lower);
  const hasBuy = /\b(buy|buying|purchase|looking for|find a home)\b/.test(lower);
  if (hasSell && hasBuy) intent = "Buy and Sell";
  else if (hasSell) intent = "Sell";
  else if (hasBuy) intent = "Buy";

  // Address / area — look after address question
  let address: string | undefined;
  for (let i = 0; i < transcript.length - 1; i++) {
    const turn = transcript[i];
    const next = transcript[i + 1];
    if (
      turn.role === "agent" &&
      /address|area|neighborhood|looking to (buy|sell)/i.test(turn.message) &&
      next.role === "user" &&
      next.message.trim().length > 0
    ) {
      address = next.message.trim().slice(0, 200);
      break;
    }
  }

  // Timeline
  let timeline: string | undefined;
  for (let i = 0; i < transcript.length - 1; i++) {
    const turn = transcript[i];
    const next = transcript[i + 1];
    if (
      turn.role === "agent" &&
      /timeline|when.*hoping|when.*buy|when.*sell|how soon/i.test(turn.message) &&
      next.role === "user" &&
      next.message.trim().length > 0
    ) {
      timeline = next.message.trim().slice(0, 100);
      break;
    }
  }

  // Budget / price
  let budget: string | undefined;
  for (let i = 0; i < transcript.length - 1; i++) {
    const turn = transcript[i];
    const next = transcript[i + 1];
    if (
      turn.role === "agent" &&
      /budget|price|asking|afford|spend/i.test(turn.message) &&
      next.role === "user" &&
      next.message.trim().length > 0
    ) {
      budget = next.message.trim().slice(0, 100);
      break;
    }
  }

  // Suppress logging of full transcript to keep this cleaner
  void allLines;

  return { name, intent, address, timeline, budget };
}

// ---------------------------------------------------------------------------
// Map ElevenLabs call → CRM agent UUID
// Strategy:
//   1. Custom voice users: their voice_agent_id matches the ElevenLabs agent_id exactly
//   2. Shared voice users (male/female preset): match by business_phone_number
//      since multiple users share the same ElevenLabs agent ID
// ---------------------------------------------------------------------------

async function findCrmAgent(
  admin: ReturnType<typeof supabaseAdmin>,
  elevenLabsAgentId: string,
  toPhone: string | null
): Promise<string | null> {
  const { data: rows } = await admin
    .from("agents")
    .select("id, settings")
    .not("settings", "is", null);

  if (!rows) return null;

  // Pass 1: custom voice — agent_id matches exactly
  for (const row of rows) {
    const settings = readReceptionistSettingsFromAgentSettings(row.settings);
    if (settings.voice_preset === "custom" && settings.voice_agent_id === elevenLabsAgentId) {
      return row.id as string;
    }
  }

  // Pass 2: shared voice — match by business phone number (the "to" number on the call)
  if (toPhone) {
    const normalized = toPhone.replace(/\s/g, "");
    for (const row of rows) {
      const settings = readReceptionistSettingsFromAgentSettings(row.settings);
      const bizPhone = settings.business_phone_number.replace(/\s/g, "");
      if (bizPhone && bizPhone === normalized) {
        return row.id as string;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  let payload: WebhookPayload;
  try {
    const body = await request.text();
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[elevenlabs-webhook] Received event type:", payload.type);

  // Only handle transcription events
  if (payload.type !== "post_call_transcription") {
    console.log("[elevenlabs-webhook] Skipping non-transcription event:", payload.type);
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data } = payload;
  const transcript = data.transcript ?? [];

  // Extract to-phone from metadata — ElevenLabs uses different field names depending on source
  const toPhone =
    (data.metadata?.to as string | undefined) ||
    (data.metadata?.phone_number as string | undefined) ||
    null;

  console.log("[elevenlabs-webhook] Processing call:", {
    agent_id: data.agent_id,
    conversation_id: data.conversation_id,
    status: data.status,
    transcript_turns: transcript.length,
    metadata: data.metadata ?? {},
    has_analysis: !!data.analysis,
  });

  // Look up the CRM agent
  const admin = supabaseAdmin();
  const agentId = await findCrmAgent(admin, data.agent_id, toPhone);

  if (!agentId) {
    console.warn("[elevenlabs-webhook] No CRM agent found.", {
      elevenlabs_agent_id: data.agent_id,
      to_phone: toPhone,
      hint: "Either save a custom agent ID in Secretary Settings, or ensure business_phone_number matches the called number.",
    });
    return NextResponse.json({ ok: true, skipped: true });
  }

  console.log("[elevenlabs-webhook] Matched CRM agent:", agentId);

  // Get phone number — ElevenLabs passes it in metadata for Twilio calls
  const phone =
    (data.metadata?.phone_number as string | undefined) ||
    (data.metadata?.caller_id as string | undefined) ||
    (data.conversation_initiation_client_data?.dynamic_variables?.caller_phone) ||
    "";

  // Extract lead fields from transcript
  const extracted = extractFromTranscript(transcript);

  // Also check data_collection_results if agent has data collection configured
  const collected = data.analysis?.data_collection_results ?? {};
  const collectedName = collected.caller_name?.value || collected.name?.value;
  const collectedIntent = collected.intent?.value;
  const collectedAddress = collected.property_address?.value || collected.address?.value;
  const collectedTimeline = collected.timeline?.value;
  const collectedBudget = collected.budget?.value || collected.price?.value;

  const name = collectedName || extracted.name;
  const intent = collectedIntent || extracted.intent;
  const address = collectedAddress || extracted.address;
  const timeline = collectedTimeline || extracted.timeline;
  const budget = collectedBudget || extracted.budget;

  // Build transcript text for notes
  const transcriptText = transcript
    .map((t) => `${t.role === "agent" ? "AI" : "Caller"}: ${t.message}`)
    .join("\n");

  const summary = data.analysis?.transcript_summary || "";

  console.log("[elevenlabs-webhook] Lead data:", { phone, name, intent, address, timeline, budget });

  try {
    await upsertReceptionistLead({
      admin,
      agentId,
      source: "call_inbound",
      values: {
        phone: phone || undefined,
        full_name: name || null,
        intent: intent || null,
        location_area: address || null,
        timeline: timeline || null,
        budget_range: budget || null,
        notes: [summary, transcriptText ? `\n\nTranscript:\n${transcriptText}` : ""]
          .filter(Boolean)
          .join("")
          .slice(0, 4000) || null,
        source_detail: {
          channel: "phone",
          event: "inbound_call",
          provider: "elevenlabs",
          conversation_id: data.conversation_id,
          call_duration_secs: data.metadata?.call_duration_secs ?? null,
          call_successful: data.analysis?.call_successful ?? null,
        },
      },
    });

    console.log("[elevenlabs-webhook] Lead saved for conversation:", data.conversation_id);
  } catch (err) {
    console.error("[elevenlabs-webhook] Failed to save lead:", err);
    // Still return 200 so ElevenLabs doesn't retry
  }

  return NextResponse.json({ ok: true });
}
