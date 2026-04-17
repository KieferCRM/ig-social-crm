import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, GOOGLE_OAUTH_KEY } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectBase = "/app/calendar";

  if (error) {
    return NextResponse.redirect(new URL(`${redirectBase}?google_error=${encodeURIComponent(error)}`, req.nextUrl.origin));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${redirectBase}?google_error=missing_params`, req.nextUrl.origin));
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL(`${redirectBase}?google_error=invalid_state`, req.nextUrl.origin));
  }

  // Authenticate the LockboxHQ user
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth", req.nextUrl.origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Merge tokens into agent settings
    const admin = supabaseAdmin();
    const { data: agent } = await admin
      .from("agents")
      .select("settings")
      .eq("id", user.id)
      .maybeSingle();

    const currentSettings = (agent?.settings ?? {}) as Record<string, unknown>;
    const updatedSettings = { ...currentSettings, [GOOGLE_OAUTH_KEY]: tokens };

    await admin
      .from("agents")
      .update({ settings: updatedSettings })
      .eq("id", user.id);

    return NextResponse.redirect(new URL(`${redirectBase}?google_connected=1`, req.nextUrl.origin));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(new URL(`${redirectBase}?google_error=${encodeURIComponent(msg)}`, req.nextUrl.origin));
  }
}
