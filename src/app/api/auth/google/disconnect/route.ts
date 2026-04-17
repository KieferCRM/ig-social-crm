import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revokeToken, readGoogleTokens, GOOGLE_OAUTH_KEY } from "@/lib/google-calendar";

export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: agent } = await admin
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const tokens = readGoogleTokens(agent?.settings);
  if (tokens) {
    try {
      await revokeToken(tokens.access_token);
    } catch {
      // best-effort revoke — still clear locally
    }
  }

  const currentSettings = (agent?.settings ?? {}) as Record<string, unknown>;
  const { [GOOGLE_OAUTH_KEY]: _removed, ...remainingSettings } = currentSettings;
  void _removed;

  await admin
    .from("agents")
    .update({ settings: remainingSettings })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
