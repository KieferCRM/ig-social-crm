/**
 * POST /api/receptionist/voice/clone
 *
 * Authenticated endpoint. Accepts a voice recording upload and submits it
 * to ElevenLabs for Instant Voice Cloning.
 *
 * Request: multipart/form-data with field "audio" (file) and "name" (string)
 * Response: { ok: true, voice_id: string } | { error: string }
 *
 * After success, caller should PATCH /api/receptionist/settings to store
 * { voice_clone_voice_id, voice_clone_status: "ready" }.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { cloneVoice, elevenLabsApiKey } from "@/lib/elevenlabs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mergeReceptionistIntoAgentSettings } from "@/lib/receptionist/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Max 20MB — ElevenLabs recommends at least 1 min of clean audio
const MAX_BYTES = 20 * 1024 * 1024;

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  const name = ((formData.get("name") as string | null) || "").trim();

  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: "audio file is required." }, { status: 400 });
  }

  if (audioFile.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio file is too large (max 20MB)." }, { status: 400 });
  }

  const mimeType = audioFile.type || "audio/mpeg";
  const voiceName = name || "My Voice";

  // Mark as pending in settings immediately so the UI can show progress
  const admin = supabaseAdmin();
  const { data: agentRow } = await admin
    .from("agents")
    .select("settings")
    .eq("id", agentId)
    .maybeSingle();

  const updatedSettings = mergeReceptionistIntoAgentSettings(agentRow?.settings ?? null, {
    voice_clone_status: "pending",
  });
  await admin.from("agents").update({ settings: updatedSettings }).eq("id", agentId);

  // Submit to ElevenLabs
  const audioBuffer = await audioFile.arrayBuffer();
  const result = await cloneVoice(voiceName, audioBuffer, mimeType);

  if (!result.ok) {
    // Mark as failed
    const failedSettings = mergeReceptionistIntoAgentSettings(agentRow?.settings ?? null, {
      voice_clone_status: "failed",
    });
    await admin.from("agents").update({ settings: failedSettings }).eq("id", agentId);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Save the cloned voice ID in settings
  const readySettings = mergeReceptionistIntoAgentSettings(agentRow?.settings ?? null, {
    voice_clone_status: "ready",
    voice_clone_voice_id: result.voiceId,
  });
  await admin.from("agents").update({ settings: readySettings }).eq("id", agentId);

  return NextResponse.json({
    ok: true,
    voice_id: result.voiceId,
    voice_name: result.voiceName,
  });
}
