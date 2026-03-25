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
import { analyzeCallTranscript } from "@/lib/receptionist/call-analyzer";

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
      /timeline|timeframe|time.?frame|when.*hoping|when.*buy|when.*sell|how soon|when.*move|when.*looking/i.test(turn.message) &&
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

  // Pass 1: any agent with this exact ElevenLabs agent ID saved
  for (const row of rows) {
    const settings = readReceptionistSettingsFromAgentSettings(row.settings);
    if (settings.voice_agent_id && settings.voice_agent_id === elevenLabsAgentId) {
      return row.id as string;
    }
  }

  // Pass 2: shared voice — match by business phone number (the "to" number on the call)
  if (toPhone) {
    const digits = (s: string) => s.replace(/\D/g, "");
    const normalizedDigits = digits(toPhone).slice(-10);
    for (const row of rows) {
      const settings = readReceptionistSettingsFromAgentSettings(row.settings);
      const bizDigits = digits(settings.business_phone_number).slice(-10);
      if (bizDigits && bizDigits === normalizedDigits) {
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

  // Extract to-phone (business number) and caller phone from metadata
  // ElevenLabs nests phone call data under metadata.phone_call
  const phoneCall = data.metadata?.phone_call as Record<string, unknown> | undefined;
  const toPhone =
    (phoneCall?.agent_number as string | undefined) ||
    (data.metadata?.to as string | undefined) ||
    (data.metadata?.phone_number as string | undefined) ||
    null;
  const callerPhoneFromMetadata =
    (phoneCall?.external_number as string | undefined) ||
    (data.metadata?.caller_id as string | undefined) ||
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

  // Get caller phone number
  const phone =
    callerPhoneFromMetadata ||
    (data.conversation_initiation_client_data?.dynamic_variables?.caller_phone) ||
    "";

  // Extract lead fields from transcript
  const extracted = extractFromTranscript(transcript);

  // Also check data_collection_results if agent has data collection configured
  const collected = data.analysis?.data_collection_results ?? {};
  const collectedName = collected.caller_name?.value || collected.name?.value;
  const collectedPhone = collected.caller_phone_number?.value || collected.phone?.value;
  const collectedIntent = collected.caller_intent?.value || collected.intent?.value;
  const collectedAddress = collected.property_address_or_area?.value || collected.property_address?.value || collected.address?.value;
  const collectedTimeline = collected.timeline?.value;
  const collectedBudget = collected.budget_range?.value || collected.budget?.value || collected.price?.value;

  const name = collectedName || extracted.name;
  const intent = collectedIntent || extracted.intent;
  const address = collectedAddress || extracted.address;
  const timeline = collectedTimeline || extracted.timeline;
  const budget = collectedBudget || extracted.budget;
  const resolvedPhone = collectedPhone || phone;

  // Build transcript text for notes
  const transcriptText = transcript
    .map((t) => `${t.role === "agent" ? "AI" : "Caller"}: ${t.message}`)
    .join("\n");

  const elevenLabsSummary = data.analysis?.transcript_summary || "";

  // Run Claude analysis on the transcript for richer extraction + urgency scoring
  const agentRow = await admin.from("agents").select("full_name").eq("id", agentId).maybeSingle();
  const agentFullName = (agentRow.data?.full_name as string | null) || "the agent";

  const claudeAnalysis = transcriptText
    ? await analyzeCallTranscript({ transcript: transcriptText, agentName: agentFullName }).catch(() => null)
    : null;

  console.log("[elevenlabs-webhook] Claude analysis:", claudeAnalysis);

  // Claude results override regex extraction; ElevenLabs data collection overrides both
  const intent = collectedIntent || claudeAnalysis?.intent || extracted.intent;
  const address = collectedAddress || claudeAnalysis?.property_area || extracted.address;
  const timeline = collectedTimeline || claudeAnalysis?.timeline || extracted.timeline;
  const budget = collectedBudget || claudeAnalysis?.budget || extracted.budget;
  const summary = elevenLabsSummary || claudeAnalysis?.summary || "";
  const urgencyScore = claudeAnalysis?.urgency === "hot" ? 85 : claudeAnalysis?.urgency === "warm" ? 55 : claudeAnalysis?.urgency === "cold" ? 20 : null;

  console.log("[elevenlabs-webhook] Lead data:", { phone, name, intent, address, timeline, budget, urgency: claudeAnalysis?.urgency });

  let leadId: string | null = null;

  try {
    const result = await upsertReceptionistLead({
      admin,
      agentId,
      source: "call_inbound",
      values: {
        phone: resolvedPhone || undefined,
        full_name: name || null,
        intent: intent || null,
        location_area: address || null,
        timeline: timeline || null,
        budget_range: budget || null,
        urgency_score: urgencyScore ?? undefined,
        urgency_level: claudeAnalysis?.urgency === "hot" ? "high" : claudeAnalysis?.urgency ? "normal" : undefined,
        notes: [
          summary,
          claudeAnalysis?.action_items ? `\nNext step: ${claudeAnalysis.action_items}` : "",
          transcriptText ? `\n\nTranscript:\n${transcriptText}` : "",
        ]
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

    leadId = result.lead.id;
    console.log("[elevenlabs-webhook] Lead saved for conversation:", data.conversation_id);
  } catch (err) {
    console.error("[elevenlabs-webhook] Failed to save lead:", err);
    // Still return 200 so ElevenLabs doesn't retry
  }

  // Create a receptionist alert so the call surfaces on the Today page
  try {
    const callerLabel = name || phone || "Unknown caller";
    const durationSecs = data.metadata?.call_duration_secs;
    const durationLabel = durationSecs ? ` (${Math.round(Number(durationSecs) / 60)}m ${Number(durationSecs) % 60}s)` : "";
    await admin.from("receptionist_alerts").insert({
      agent_id: agentId,
      lead_id: leadId,
      alert_type: "call_inbound",
      status: "open",
      severity: "info",
      title: `Inbound call — ${callerLabel}`,
      message: summary || `Inbound call received${durationLabel}. ${intent ? `Intent: ${intent}.` : ""} ${address ? `Area: ${address}.` : ""}`.trim(),
      metadata: {
        conversation_id: data.conversation_id,
        call_duration_secs: durationSecs ?? null,
        caller_phone: phone || null,
        call_successful: data.analysis?.call_successful ?? null,
      },
    });
  } catch (err) {
    console.warn("[elevenlabs-webhook] Could not create call alert:", err);
  }

  // Save to lead_interactions so the Secretary activity + transcripts tabs populate
  if (leadId) {
    try {
      await admin.from("lead_interactions").insert({
        agent_id: agentId,
        lead_id: leadId,
        channel: "call_inbound",
        direction: "inbound",
        interaction_type: "voice_call",
        status: data.status || "completed",
        raw_transcript: transcriptText || null,
        raw_message_body: summary || null,
        summary: summary || null,
        structured_payload: {
          conversation_id: data.conversation_id,
          call_duration_secs: data.metadata?.call_duration_secs ?? null,
          call_successful: data.analysis?.call_successful ?? null,
          caller_phone: resolvedPhone || null,
          collected: {
            name,
            intent,
            address,
            timeline,
            budget,
          },
        },
      });
      console.log("[elevenlabs-webhook] lead_interactions row saved for:", leadId);
    } catch (err) {
      console.warn("[elevenlabs-webhook] Could not save lead_interaction:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
