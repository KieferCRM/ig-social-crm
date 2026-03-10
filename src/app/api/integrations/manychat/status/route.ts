import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseServer } from "@/lib/supabase/server";

function baseUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host || "localhost:3000";
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const webhookUrl = `${baseUrl(request)}/api/integrations/manychat/webhook`;
  const enabled = process.env.FEATURE_MANYCHAT_ENABLED === "true";
  const hasSecret = Boolean(process.env.MANYCHAT_WEBHOOK_SECRET);
  const hasAgent = Boolean(process.env.MANYCHAT_AGENT_ID);

  return NextResponse.json({
    enabled,
    configured: enabled && hasSecret && hasAgent,
    webhook_url: webhookUrl,
    checks: {
      has_secret: hasSecret,
      has_agent_id: hasAgent,
    },
  });
}
