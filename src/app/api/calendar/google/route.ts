import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  readGoogleTokens,
  ensureValidToken,
  fetchCalendarEvents,
  GOOGLE_OAUTH_KEY,
} from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
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
  if (!tokens) {
    return NextResponse.json({ connected: false, events: [] });
  }

  try {
    const { searchParams } = req.nextUrl;
    const timeMin = searchParams.get("timeMin") ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
    const timeMax = searchParams.get("timeMax") ?? new Date(Date.now() + 30 * 86_400_000).toISOString();

    const { tokens: validTokens, refreshed } = await ensureValidToken(tokens);

    // Persist refreshed tokens if they changed
    if (refreshed) {
      const currentSettings = (agent?.settings ?? {}) as Record<string, unknown>;
      await admin
        .from("agents")
        .update({ settings: { ...currentSettings, [GOOGLE_OAUTH_KEY]: validTokens } })
        .eq("id", user.id);
    }

    const events = await fetchCalendarEvents(validTokens, { timeMin, timeMax, maxResults: 100 });

    return NextResponse.json({
      connected: true,
      connected_email: validTokens.connected_email,
      events,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Calendar fetch failed";
    return NextResponse.json({ connected: true, error: msg, events: [] }, { status: 500 });
  }
}
