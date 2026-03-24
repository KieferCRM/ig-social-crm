import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { loadAccessContext } from "@/lib/access-context";
import {
  mergeReceptionistIntoAgentSettings,
  readReceptionistSettingsFromAgentSettings,
} from "@/lib/receptionist/settings";
import { supabaseServer } from "@/lib/supabase/server";
import {
  updateElevenLabsPhoneNumberAgent,
  findElevenLabsPhoneNumberId,
} from "@/lib/elevenlabs";

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: readReceptionistSettingsFromAgentSettings(data?.settings || null),
  });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Record<string, unknown>>(request, {
    maxBytes: 48 * 1024,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { data: currentRow, error: loadError } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  const currentSettings = readReceptionistSettingsFromAgentSettings(currentRow?.settings || null);
  const mergedSettings = mergeReceptionistIntoAgentSettings(
    currentRow?.settings || null,
    parsed.data
  );

  const { data: savedRow, error: saveError } = await supabase
    .from("agents")
    .upsert(
      {
        id: auth.context.user.id,
        settings: mergedSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("settings")
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  const savedSettings = readReceptionistSettingsFromAgentSettings(savedRow?.settings || null);

  // If voice_preset changed to female or male, swap the ElevenLabs agent on the phone number
  const newPreset = savedSettings.voice_preset;
  if (
    newPreset !== currentSettings.voice_preset &&
    (newPreset === "female" || newPreset === "male")
  ) {
    const newAgentId = newPreset === "male"
      ? (process.env.ELEVENLABS_AGENT_MALE || "").trim()
      : (process.env.ELEVENLABS_AGENT_FEMALE || "").trim();

    if (newAgentId && savedSettings.business_phone_number) {
      // Use stored ElevenLabs phone number ID, or look it up if not stored yet
      let elevenLabsPhoneNumberId = savedSettings.elevenlabs_phone_number_id;
      if (!elevenLabsPhoneNumberId) {
        elevenLabsPhoneNumberId = await findElevenLabsPhoneNumberId(savedSettings.business_phone_number) || "";
      }
      if (elevenLabsPhoneNumberId) {
        await updateElevenLabsPhoneNumberAgent(elevenLabsPhoneNumberId, newAgentId).catch((err) => {
          console.warn("[receptionist/settings] ElevenLabs agent swap failed:", err);
        });
      }
    }
  }

  return NextResponse.json({ settings: savedSettings });
}
