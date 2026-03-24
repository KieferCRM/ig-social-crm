import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";
import {
  mergeReceptionistIntoAgentSettings,
  readReceptionistSettingsFromAgentSettings,
  type ReceptionistSettings,
} from "@/lib/receptionist/settings";
import { assignReceptionistBusinessNumber } from "@/lib/receptionist/provider";
import { supabaseServer } from "@/lib/supabase/server";

type AssignBody = {
  area_code?: string | null;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<AssignBody>(request, {
    maxBytes: 8 * 1024,
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

  const areaCode = optionalString(parsed.data?.area_code || null);
  const assignment = await assignReceptionistBusinessNumber({
    agentId: auth.context.user.id,
    areaCode,
  });

  if (!assignment.ok || !assignment.businessPhoneNumber) {
    return NextResponse.json(
      {
        error: assignment.error || "Could not assign a business number.",
        assignment,
      },
      { status: assignment.status === "manual_review_required" ? 409 : 500 }
    );
  }

  const nextPatch: Partial<ReceptionistSettings> & Record<string, unknown> = {
    phone_setup_path: "lockbox_number",
    phone_setup_status: "assigned",
    business_phone_number: assignment.businessPhoneNumber,
    business_number_provider: assignment.provider,
    existing_number_setup_notes: "",
    ...(assignment.elevenLabsPhoneNumberId ? { elevenlabs_phone_number_id: assignment.elevenLabsPhoneNumberId } : {}),
  };

  const mergedSettings = mergeReceptionistIntoAgentSettings(
    currentRow?.settings || null,
    nextPatch
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

  return NextResponse.json({
    ok: true,
    assignment,
    settings: readReceptionistSettingsFromAgentSettings(savedRow?.settings || null),
  });
}
