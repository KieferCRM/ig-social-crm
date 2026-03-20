/**
 * GET /api/receptionist/voice/tts?text=...&voice_id=...&sig=...
 *
 * Public signed endpoint that streams ElevenLabs TTS audio.
 * Twilio fetches this URL inside <Play> tags during live calls.
 * The HMAC signature prevents unauthorized use as a free TTS proxy.
 */
import { NextResponse } from "next/server";
import { generateSpeechForTwilio, verifyTtsSignature } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Twilio caches <Play> URLs during a call — 30 minute max age is fine
const CACHE_MAX_AGE = 1800;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const text = (url.searchParams.get("text") || "").trim();
  const voiceId = (url.searchParams.get("voice_id") || "").trim();
  const sig = (url.searchParams.get("sig") || "").trim();

  if (!text || !voiceId || !sig) {
    return NextResponse.json(
      { error: "text, voice_id, and sig are required." },
      { status: 400 }
    );
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: "Text too long." }, { status: 400 });
  }

  if (!verifyTtsSignature(text, voiceId, sig)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const result = await generateSpeechForTwilio(text, voiceId);

  if (!result.ok) {
    // Fallback: return Twilio-compatible silence (empty ulaw stream)
    // Twilio will move on to the next TwiML verb rather than stalling
    console.warn("[voice/tts] ElevenLabs failed, returning fallback:", result.error);
    return new Response(new Uint8Array(0), {
      status: 200,
      headers: {
        "Content-Type": "audio/basic",
        "Content-Length": "0",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(result.audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      "Content-Length": String(result.audioBuffer.byteLength),
    },
  });
}
