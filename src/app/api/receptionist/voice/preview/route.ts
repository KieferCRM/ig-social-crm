/**
 * GET /api/receptionist/voice/preview?voice_id=...&text=...
 *
 * Authenticated endpoint — returns ElevenLabs TTS audio for voice preview
 * in the Secretary settings page. Agents use this to hear each preset voice
 * before selecting one.
 */
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { generateSpeechMp3, elevenLabsApiKey } from "@/lib/elevenlabs";
import { findPresetVoice } from "@/lib/elevenlabs/voices";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PREVIEW_TEXT_DEFAULT =
  "Hi there! I'm your AI assistant for LockboxHQ. How can I help you today?";

export async function GET(request: Request): Promise<Response> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!elevenLabsApiKey()) {
    return NextResponse.json(
      { error: "ElevenLabs is not configured on this server." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const voiceId = (url.searchParams.get("voice_id") || "").trim();
  const customText = (url.searchParams.get("text") || "").trim();

  if (!voiceId) {
    return NextResponse.json({ error: "voice_id is required." }, { status: 400 });
  }

  // Only allow preset voices (prevents abuse for arbitrary voice IDs)
  const preset = findPresetVoice(voiceId);
  if (!preset) {
    return NextResponse.json(
      { error: "voice_id is not a recognized preset. Only preset voices can be previewed." },
      { status: 400 }
    );
  }

  const previewText = customText.slice(0, 200) || PREVIEW_TEXT_DEFAULT;
  const result = await generateSpeechMp3(previewText, voiceId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return new Response(result.audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(result.audioBuffer.byteLength),
    },
  });
}
