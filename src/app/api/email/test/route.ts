import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { readEmailConfig, type EmailConfig } from "@/lib/email/credentials";
import { testImap } from "@/lib/email/imap";
import { testSmtp } from "@/lib/email/smtp";

export const dynamic = "force-dynamic";

// POST { email, password, imap_host, imap_port, imap_tls, smtp_host, smtp_port, smtp_secure }
// Tests IMAP + SMTP with the provided credentials (before saving)
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

  const [imapResult, smtpResult] = await Promise.all([
    testImap(config),
    testSmtp(config),
  ]);

  return NextResponse.json({
    imap: imapResult,
    smtp: smtpResult,
    ok: imapResult.ok && smtpResult.ok,
  });
}

// GET — test with stored credentials
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const config = readEmailConfig(agent?.settings as Record<string, unknown> | null);
  if (!config) return NextResponse.json({ error: "No email configured." }, { status: 404 });

  const [imapResult, smtpResult] = await Promise.all([
    testImap(config),
    testSmtp(config),
  ]);

  return NextResponse.json({
    imap: imapResult,
    smtp: smtpResult,
    ok: imapResult.ok && smtpResult.ok,
  });
}
