/**
 * PATCH /api/agent/social
 *
 * Saves social handle fields into agents.settings.social_handles.
 * Used during onboarding and profile settings.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SocialHandles = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
};

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<SocialHandles>(request, { maxBytes: 2048 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const agentId = auth.context.user.id;

  const { data: current } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", agentId)
    .maybeSingle();

  const currentSettings = (current?.settings ?? {}) as Record<string, unknown>;
  const existingHandles = (currentSettings.social_handles ?? {}) as Record<string, string>;

  const merged: Record<string, string> = { ...existingHandles };
  const fields: (keyof SocialHandles)[] = ["instagram", "facebook", "linkedin", "youtube", "website"];
  for (const field of fields) {
    if (parsed.data[field] !== undefined) {
      merged[field] = (parsed.data[field] ?? "").trim();
    }
  }

  const { error } = await supabase
    .from("agents")
    .update({
      settings: { ...currentSettings, social_handles: merged },
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
