import { createCipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FEATURE_META_ENABLED } from "@/lib/features";
import { supabaseServer } from "@/lib/supabase/server";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

type MetaAccount = {
  id: string;
  instagram_business_account?: { id?: string } | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildKey(): Buffer {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (secret) {
    return createHash("sha256").update(secret).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required env var: META_TOKEN_ENCRYPTION_KEY");
  }

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || "meta-token-dev-key";
  console.warn("[meta.connect.callback] using non-production fallback token encryption key");
  return createHash("sha256").update(fallback).digest();
}

function encryptToken(raw: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", buildKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

async function fetchToken(code: string, redirectUri: string): Promise<TokenResponse> {
  const appId = requireEnv("META_APP_ID");
  const appSecret = requireEnv("META_APP_SECRET");

  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const response = await fetch(tokenUrl.toString(), { method: "GET" });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Meta token exchange failed: ${message}`);
  }

  return (await response.json()) as TokenResponse;
}

async function fetchMetaBusinessId(accessToken: string): Promise<string | null> {
  const accountsUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
  accountsUrl.searchParams.set("fields", "id,instagram_business_account{id}");
  accountsUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(accountsUrl.toString(), { method: "GET" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data?: MetaAccount[] };
  const first = payload.data?.[0];
  if (!first) return null;

  return first.instagram_business_account?.id || first.id || null;
}

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!FEATURE_META_ENABLED) {
    return NextResponse.redirect(`${baseUrl}/app/settings/channels?meta=disabled`);
  }

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(`${baseUrl}/auth?error=meta_unauthorized`);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("meta_oauth_state")?.value;

    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      console.warn("[meta.connect.callback] invalid state", {
        user_id: user.id,
        has_code: Boolean(code),
        has_returned_state: Boolean(returnedState),
        has_expected_state: Boolean(expectedState),
      });
      return NextResponse.redirect(`${baseUrl}/app/settings/channels?meta=error_state`);
    }

    const expectedUserId = expectedState.split(":")[0];
    if (expectedUserId !== user.id) {
      console.warn("[meta.connect.callback] state-user mismatch", {
        expected_user_id: expectedUserId,
        actual_user_id: user.id,
      });
      return NextResponse.redirect(`${baseUrl}/app/settings/channels?meta=error_state`);
    }

    const redirectUri =
      process.env.META_REDIRECT_URI || `${baseUrl}/api/meta/connect/callback`;

    const token = await fetchToken(code, redirectUri);
    const metaBusinessId = await fetchMetaBusinessId(token.access_token);

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

    const encryptedAccess = encryptToken(token.access_token);

    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error: upsertError } = await admin.from("meta_tokens").upsert(
      {
        agent_id: user.id,
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: null,
        expires_at: expiresAt,
        meta_user_id: metaBusinessId,
      },
      { onConflict: "agent_id" }
    );

    if (upsertError) {
      console.error("[meta.connect.callback] token store failed", {
        user_id: user.id,
        error: upsertError.message,
      });
      return NextResponse.redirect(`${baseUrl}/app/settings/channels?meta=error_store`);
    }

    cookieStore.delete("meta_oauth_state");

    console.info("[meta.connect.callback] connected", {
      user_id: user.id,
      meta_user_id: metaBusinessId,
      expires_at: expiresAt,
    });

    return NextResponse.redirect(`${baseUrl}/app/settings/channels?meta=connected`);
  } catch (error) {
    console.error("[meta.connect.callback] failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.redirect(`${baseUrl}/app/settings/channels?meta=error_callback`);
  }
}
