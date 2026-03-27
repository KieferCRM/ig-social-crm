import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PostmarkSendBody = {
  From: string;
  To: string;
  Subject: string;
  TextBody: string;
  ReplyTo?: string;
  Headers?: Array<{ Name: string; Value: string }>;
};

type PostmarkSendResponse = {
  MessageID?: string;
  ErrorCode?: number;
  Message?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Reply not configured (missing POSTMARK_SERVER_TOKEN)." }, { status: 503 });
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;

  // Load the original inbox message
  const { data: msg } = await supabase
    .from("inbox_messages")
    .select("id, from_email, from_name, subject, body_text, agent_id")
    .eq("id", messageId)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!msg) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  if (!msg.from_email) {
    return NextResponse.json({ error: "No sender address to reply to." }, { status: 400 });
  }

  // Load agent name for the From line
  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, settings")
    .eq("id", user.id)
    .maybeSingle();

  const agentName = (agent?.full_name as string | null) ?? "Your Agent";
  const settings = (agent?.settings ?? {}) as Record<string, unknown>;
  const agentEmail = (settings.email as string | null) ?? null;

  const { replyText } = await req.json() as { replyText: string };
  if (!replyText?.trim()) {
    return NextResponse.json({ error: "Reply cannot be empty." }, { status: 400 });
  }

  const originalSubject = (msg.subject as string | null) ?? "(no subject)";
  const replySubject = originalSubject.startsWith("Re:") ? originalSubject : `Re: ${originalSubject}`;

  // Quote the original body
  const quotedOriginal = msg.body_text
    ? `\n\n---\nOn ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, ${msg.from_name ?? msg.from_email} wrote:\n\n${msg.body_text.slice(0, 1500)}`
    : "";

  const fullText = `${replyText.trim()}${quotedOriginal}`;

  const sendBody: PostmarkSendBody = {
    From: `${agentName} via LockboxHQ <hello@lockboxhq.com>`,
    To: msg.from_email,
    Subject: replySubject,
    TextBody: fullText,
  };

  // If agent has their own email stored, set Reply-To so responses come back to them
  if (agentEmail) {
    sendBody.ReplyTo = agentEmail;
  }

  const pmRes = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify(sendBody),
  });

  const pmData = (await pmRes.json()) as PostmarkSendResponse;

  if (!pmRes.ok || pmData.ErrorCode) {
    const msg = pmData.Message ?? "Failed to send via Postmark.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
