import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { FEATURE_META_ENABLED } from "@/lib/features";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function POST() {
  if (!FEATURE_META_ENABLED) {
    return NextResponse.json(
      { error: "Meta integration is currently disabled." },
      { status: 503 }
    );
  }

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const appId = requireEnv("META_APP_ID");
    const redirectUri =
      process.env.META_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/meta/connect/callback`;

    const nonce = randomBytes(16).toString("hex");
    const state = `${user.id}:${nonce}`;

    const cookieStore = await cookies();
    cookieStore.set("meta_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    const connectUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    connectUrl.searchParams.set("client_id", appId);
    connectUrl.searchParams.set("redirect_uri", redirectUri);
    connectUrl.searchParams.set(
      "scope",
      "pages_show_list,pages_messaging,instagram_basic,instagram_manage_messages"
    );
    connectUrl.searchParams.set("response_type", "code");
    connectUrl.searchParams.set("state", state);

    return NextResponse.json({
      ok: true,
      message: "Redirecting to Meta OAuth.",
      connect_url: connectUrl.toString(),
    });
  } catch (error) {
    console.error("[meta.connect.start] failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not start Meta connect.",
      },
      { status: 500 }
    );
  }
}
