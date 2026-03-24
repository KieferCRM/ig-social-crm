import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export function elevenLabsApiKey(): string | null {
  const key = (process.env.ELEVENLABS_API_KEY || "").trim();
  return key || null;
}

// ---------------------------------------------------------------------------
// TTS URL signing
// Used so our public /api/receptionist/voice/tts endpoint can't be abused as
// a free proxy. Twilio fetches these signed URLs during live calls.
// ---------------------------------------------------------------------------

const TTS_SIG_VERSION = "v1";

export function signTtsParams(text: string, voiceId: string): string {
  const key = elevenLabsApiKey() || "no-key";
  const message = `${TTS_SIG_VERSION}:${voiceId}:${text}`;
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

export function verifyTtsSignature(text: string, voiceId: string, sig: string): boolean {
  if (!sig) return false;
  const expected = signTtsParams(text, voiceId);
  // Constant-time comparison
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Build a signed Twilio-playable TTS URL for use inside TwiML <Play> tags.
 * baseUrl should be the full public origin, e.g. "https://lockboxhq.com"
 */
export function buildTtsPlayUrl(text: string, voiceId: string, baseUrl: string): string {
  const sig = signTtsParams(text, voiceId);
  const params = new URLSearchParams({
    text,
    voice_id: voiceId,
    sig,
  });
  return `${baseUrl}/api/receptionist/voice/tts?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// TTS audio stream — returns Response with ulaw/8000 audio for Twilio
// ---------------------------------------------------------------------------

export type TtsResult =
  | { ok: true; audioBuffer: ArrayBuffer; contentType: string }
  | { ok: false; error: string };

/**
 * Generate speech using ElevenLabs TTS REST API.
 * Returns ulaw_8000 audio (8-bit μ-law at 8kHz) — natively playable by Twilio.
 * Falls back to a plain error object if the API is unavailable.
 */
export async function generateSpeechForTwilio(
  text: string,
  voiceId: string
): Promise<TtsResult> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) {
    return { ok: false, error: "ElevenLabs API key not configured." };
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/basic",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        output_format: "ulaw_8000",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { ok: false, error: `ElevenLabs TTS error ${response.status}: ${errText}` };
    }

    const audioBuffer = await response.arrayBuffer();
    return { ok: true, audioBuffer, contentType: "audio/basic" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ElevenLabs TTS request failed.";
    return { ok: false, error: message };
  }
}

/**
 * Generate speech in MP3 format — suitable for browser playback (settings preview, etc.)
 */
export async function generateSpeechMp3(
  text: string,
  voiceId: string
): Promise<TtsResult> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) {
    return { ok: false, error: "ElevenLabs API key not configured." };
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        output_format: "mp3_44100_64",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { ok: false, error: `ElevenLabs TTS error ${response.status}: ${errText}` };
    }

    const audioBuffer = await response.arrayBuffer();
    return { ok: true, audioBuffer, contentType: "audio/mpeg" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ElevenLabs TTS request failed.";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// ElevenLabs Conversational AI agent management
// ---------------------------------------------------------------------------

export type ElevenLabsAgentConfig = {
  agentName: string;       // Internal name for the agent (shown in ElevenLabs dashboard)
  voiceName: string;       // What the AI introduces itself as
  voiceId: string;
  systemPrompt: string;
  firstMessage: string;
};

export type AgentUpsertResult =
  | { ok: true; agentId: string }
  | { ok: false; error: string };

/**
 * Create a new ElevenLabs Conversational AI agent.
 * Returns the agent ID to store in agent settings.
 */
export async function createConversationalAgent(
  config: ElevenLabsAgentConfig
): Promise<AgentUpsertResult> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) return { ok: false, error: "ElevenLabs API key not configured." };

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: config.agentName,
        conversation_config: {
          agent: {
            prompt: {
              prompt: config.systemPrompt,
            },
            first_message: config.firstMessage,
            language: "en",
          },
          tts: {
            voice_id: config.voiceId,
            model_id: "eleven_turbo_v2",
          },
        },
      }),
    });

    const data = (await response.json()) as { agent_id?: string; message?: string };
    if (!response.ok || !data.agent_id) {
      return { ok: false, error: data.message || "Could not create ElevenLabs agent." };
    }

    return { ok: true, agentId: data.agent_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ElevenLabs agent creation failed.";
    return { ok: false, error: message };
  }
}

/**
 * Update an existing ElevenLabs Conversational AI agent.
 */
export async function updateConversationalAgent(
  agentId: string,
  config: Partial<ElevenLabsAgentConfig>
): Promise<AgentUpsertResult> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) return { ok: false, error: "ElevenLabs API key not configured." };

  const body: Record<string, unknown> = {};
  if (config.agentName) body.name = config.agentName;

  const conversationConfig: Record<string, unknown> = {};
  if (config.systemPrompt || config.firstMessage) {
    conversationConfig.agent = {
      ...(config.systemPrompt ? { prompt: { prompt: config.systemPrompt } } : {}),
      ...(config.firstMessage ? { first_message: config.firstMessage } : {}),
    };
  }
  if (config.voiceId) {
    conversationConfig.tts = { voice_id: config.voiceId, model_id: "eleven_turbo_v2" };
  }
  if (Object.keys(conversationConfig).length > 0) {
    body.conversation_config = conversationConfig;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = (await response.json()) as { agent_id?: string; message?: string };
    if (!response.ok) {
      return { ok: false, error: data.message || "Could not update ElevenLabs agent." };
    }

    return { ok: true, agentId: data.agent_id || agentId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ElevenLabs agent update failed.";
    return { ok: false, error: message };
  }
}

/**
 * Get a signed WebSocket URL for ElevenLabs Conversational AI.
 * Used in TwiML <Connect><Stream> for real-time call handling.
 */
export async function getConversationalAgentStreamUrl(agentId: string): Promise<string | null> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey || !agentId) return null;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: "GET",
        headers: { "xi-api-key": apiKey },
      }
    );

    const data = (await response.json()) as { signed_url?: string };
    return data.signed_url ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Voice cloning
// ---------------------------------------------------------------------------

export type CloneVoiceResult =
  | { ok: true; voiceId: string; voiceName: string }
  | { ok: false; error: string };

/**
 * Clone a voice using ElevenLabs Instant Voice Cloning.
 * audioBuffer should be at least 60 seconds of clean speech audio.
 * mimeType: e.g. "audio/mpeg", "audio/wav", "audio/webm"
 */
export async function cloneVoice(
  name: string,
  audioBuffer: ArrayBuffer,
  mimeType: string
): Promise<CloneVoiceResult> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) return { ok: false, error: "ElevenLabs API key not configured." };

  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("webm") ? "webm" : "mp3";
  const filename = `voice_clone_${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", "LockboxHQ Secretary voice clone");
  formData.append("files", new Blob([audioBuffer], { type: mimeType }), filename);

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: formData,
    });

    const data = (await response.json()) as { voice_id?: string; message?: string };
    if (!response.ok || !data.voice_id) {
      return { ok: false, error: data.message || "Voice cloning failed." };
    }

    return { ok: true, voiceId: data.voice_id, voiceName: name };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice cloning request failed.";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// ElevenLabs phone number management (Twilio integration)
// ---------------------------------------------------------------------------

export type ElevenLabsPhoneNumber = {
  phone_number_id: string;
  phone_number: string;
  provider: string;
  target_agent_id: string;
  label?: string;
};

export async function listElevenLabsPhoneNumbers(): Promise<ElevenLabsPhoneNumber[]> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) return [];
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      headers: { "xi-api-key": apiKey },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { phone_numbers?: ElevenLabsPhoneNumber[] };
    return data.phone_numbers || [];
  } catch {
    return [];
  }
}

export async function findElevenLabsPhoneNumberId(phoneNumber: string): Promise<string | null> {
  const numbers = await listElevenLabsPhoneNumbers();
  const normalized = phoneNumber.replace(/\s/g, "");
  return numbers.find((n) => n.phone_number.replace(/\s/g, "") === normalized)?.phone_number_id ?? null;
}

export async function registerTwilioNumberWithElevenLabs(input: {
  phoneNumber: string;
  twilioPhoneNumberSid: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  agentId: string;
  label?: string;
}): Promise<{ ok: boolean; phoneNumberId: string | null; error: string | null }> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) return { ok: false, phoneNumberId: null, error: "ElevenLabs API key not configured." };
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers/twilio", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: input.phoneNumber,
        phone_number_sid: input.twilioPhoneNumberSid,
        sid: input.twilioAccountSid,
        token: input.twilioAuthToken,
        target_agent_id: input.agentId,
        label: input.label || input.phoneNumber,
      }),
    });
    const data = (await response.json()) as { phone_number_id?: string; message?: string };
    if (!response.ok || !data.phone_number_id) {
      return { ok: false, phoneNumberId: null, error: data.message || "Failed to register number with ElevenLabs." };
    }
    return { ok: true, phoneNumberId: data.phone_number_id, error: null };
  } catch {
    return { ok: false, phoneNumberId: null, error: "ElevenLabs phone number registration failed." };
  }
}

export async function updateElevenLabsPhoneNumberAgent(
  phoneNumberId: string,
  agentId: string
): Promise<{ ok: boolean; error: string | null }> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey) return { ok: false, error: "ElevenLabs API key not configured." };
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`,
      {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ target_agent_id: agentId }),
      }
    );
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      return { ok: false, error: data.message || "Failed to update ElevenLabs phone number agent." };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "ElevenLabs phone number update failed." };
  }
}

// ---------------------------------------------------------------------------
// Fetch conversation transcript (after a streamed call ends)
// ---------------------------------------------------------------------------

export type ConversationTranscript = {
  conversationId: string;
  status: string;
  transcript: string;
  startTime: string | null;
  endTime: string | null;
};

export async function fetchConversationTranscript(
  conversationId: string
): Promise<ConversationTranscript | null> {
  const apiKey = elevenLabsApiKey();
  if (!apiKey || !conversationId) return null;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      conversation_id?: string;
      status?: string;
      transcript?: Array<{ role: string; message: string; time_in_call_secs?: number }>;
      metadata?: { start_time_unix_secs?: number; call_duration_secs?: number };
    };

    const lines = (data.transcript || []).map((t) => `${t.role === "agent" ? "AI" : "Caller"}: ${t.message}`);
    const fullTranscript = lines.join("\n");

    const startUnix = data.metadata?.start_time_unix_secs;
    const durSecs = data.metadata?.call_duration_secs;

    return {
      conversationId: data.conversation_id || conversationId,
      status: data.status || "unknown",
      transcript: fullTranscript,
      startTime: startUnix ? new Date(startUnix * 1000).toISOString() : null,
      endTime:
        startUnix && durSecs
          ? new Date((startUnix + durSecs) * 1000).toISOString()
          : null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build the system prompt for the LockboxHQ voice AI
// ---------------------------------------------------------------------------

export type AgentPromptConfig = {
  voiceName: string;           // "Sarah"
  agentName: string;           // "Alex Johnson"
  agencyName: string;          // "Johnson Realty"
  callHandlingMode: string;
  existingLeadContext: {
    name?: string;
    intent?: string;
    timeline?: string;
    budget?: string;
    address?: string;
  } | null;
};

export function buildAgentSystemPrompt(config: AgentPromptConfig): string {
  const knownFields: string[] = [];
  if (config.existingLeadContext?.name) knownFields.push(`name: ${config.existingLeadContext.name}`);
  if (config.existingLeadContext?.intent) knownFields.push(`intent: ${config.existingLeadContext.intent}`);
  if (config.existingLeadContext?.timeline) knownFields.push(`timeline: ${config.existingLeadContext.timeline}`);
  if (config.existingLeadContext?.address) knownFields.push(`property address: ${config.existingLeadContext.address}`);
  if (config.existingLeadContext?.budget) knownFields.push(`budget/price: ${config.existingLeadContext.budget}`);

  const knownContext = knownFields.length > 0
    ? `\n\nExisting info on this caller: ${knownFields.join(", ")}. Do not ask for information you already have.`
    : "";

  const transferNote =
    config.callHandlingMode === "qualify_transfer"
      ? "After collecting the key details, let the caller know you will connect them with the agent."
      : config.callHandlingMode === "always_transfer"
        ? "After a brief greeting, let the caller know you will connect them directly."
        : config.callHandlingMode === "qualify_callback"
          ? "After collecting details, offer to have the agent call them back at a convenient time."
          : "After collecting details, let the caller know the agent will follow up shortly.";

  return `You are ${config.voiceName}, a professional AI assistant for ${config.agentName}${config.agencyName ? ` at ${config.agencyName}` : ""}.
Your job is to answer inbound real estate calls professionally and collect key qualifying information.

Key information to collect (only ask for what is missing):
1. Caller's name
2. Whether they are looking to buy or sell (or both)
3. Property address (for sellers) or target area/neighborhood (for buyers)
4. Their timeline — when they are hoping to buy or sell
5. Their budget (buyers) or asking price (sellers)
${knownContext}

Be conversational, warm, and professional. Ask one question at a time. Do not ask all questions at once.
If a caller seems urgent or ready to act, acknowledge that and move quickly.
${transferNote}

End the call by thanking the caller and letting them know the agent will be in touch.
Never discuss pricing, commission, or legal matters — defer those to the agent.
Keep responses brief and phone-appropriate (no long monologues).`.trim();
}

export function buildFirstMessage(voiceName: string, agentDisplayName: string): string {
  const agent = agentDisplayName.trim() || "the team";
  return `Hi, thanks for calling! You've reached ${voiceName}, the AI assistant for ${agent}. How can I help you today?`;
}
