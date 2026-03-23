import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { readEmailConfig } from "@/lib/email/credentials";
import { sendEmail } from "@/lib/email/smtp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const config = readEmailConfig(agent?.settings as Record<string, unknown> | null);
  if (!config) {
    return NextResponse.json({ error: "No email account connected. Go to Settings → Email to connect." }, { status: 400 });
  }

  const body = await req.json() as {
    to: string;
    subject: string;
    text: string;
    html?: string;
    contact_id?: string;
  };

  if (!body.to || !body.subject || !body.text) {
    return NextResponse.json({ error: "Missing to, subject, or text." }, { status: 400 });
  }

  const result = await sendEmail(config, {
    to: body.to,
    subject: body.subject,
    text: body.text,
    html: body.html,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Log the sent email to agent_emails
  await supabase.from("agent_emails").insert({
    agent_id: user.id,
    contact_id: body.contact_id ?? null,
    direction: "outbound",
    from_address: config.email,
    to_address: body.to.toLowerCase().trim(),
    subject: body.subject,
    body_text: body.text,
    message_id: null,
    received_at: new Date().toISOString(),
    attachments: [],
  });

  return NextResponse.json({ ok: true });
}
