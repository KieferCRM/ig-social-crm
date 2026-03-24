/**
 * PATCH /api/agent/profile
 *
 * Saves agent profile fields: full_name (dedicated column) and brokerage/
 * business_phone stored in settings JSONB. Used during onboarding and
 * profile settings page.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  full_name?: string;
  brokerage?: string;
  business_phone?: string;
};

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Body>(request, { maxBytes: 2048 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { full_name, brokerage, business_phone } = parsed.data;
  const agentId = auth.context.user.id;

  // Read current settings so we can merge
  const { data: current } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", agentId)
    .maybeSingle();

  const currentSettings = (current?.settings ?? {}) as Record<string, unknown>;

  const mergedSettings: Record<string, unknown> = { ...currentSettings };
  if (brokerage !== undefined) mergedSettings.brokerage = brokerage.trim();
  if (business_phone !== undefined) {
    mergedSettings.business_phone_number = business_phone.trim();
  }

  const updatePayload: Record<string, unknown> = {
    settings: mergedSettings,
    updated_at: new Date().toISOString(),
  };
  if (full_name !== undefined) updatePayload.full_name = full_name.trim();

  const { error } = await supabase
    .from("agents")
    .update(updatePayload)
    .eq("id", agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
