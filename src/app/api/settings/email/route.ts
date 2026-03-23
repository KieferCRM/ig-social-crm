import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { readEmailConfig, writeEmailConfig, clearEmailConfig, type EmailConfig } from "@/lib/email/credentials";

export const dynamic = "force-dynamic";

// GET — return current connection status (never return the password)
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const cfg = readEmailConfig(agent?.settings as Record<string, unknown> | null);
  if (!cfg) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    email: cfg.email,
    imap_host: cfg.imap_host,
    smtp_host: cfg.smtp_host,
    connected_at: cfg.connected_at,
  });
}

// POST — save credentials
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<EmailConfig>;
  if (!body.email || !body.password || !body.imap_host || !body.smtp_host) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const config: EmailConfig = {
    email: body.email.trim().toLowerCase(),
    password: body.password,
    imap_host: body.imap_host.trim(),
    imap_port: body.imap_port ?? 993,
    imap_tls: body.imap_tls !== false,
    smtp_host: body.smtp_host.trim(),
    smtp_port: body.smtp_port ?? 465,
    smtp_secure: body.smtp_secure !== false,
    connected_at: new Date().toISOString(),
  };

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const newSettings = writeEmailConfig(agent?.settings as Record<string, unknown> | null, config);

  const { error } = await supabase
    .from("agents")
    .update({ settings: newSettings })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, email: config.email });
}

// DELETE — disconnect email
export async function DELETE() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const newSettings = clearEmailConfig(agent?.settings as Record<string, unknown> | null);

  const { error } = await supabase
    .from("agents")
    .update({ settings: newSettings })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
