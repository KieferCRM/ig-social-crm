import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type Params = {
  params: Promise<{ conversationId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { conversationId } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as { text?: string };
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Reply text is required." }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(ownerFilter(auth.context))
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const metaMessageId = `manual_${Date.now()}_${randomUUID().slice(0, 8)}`;

  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      agent_id: auth.context.user.id,
      conversation_id: conversationId,
      meta_message_id: metaMessageId,
      direction: "out",
      text,
      ts: now,
      raw_json: { manual: true, status: "queued_for_send" },
    })
    .select("id, meta_message_id, direction, text, ts, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from("conversations").update({ last_message_at: now }).eq("id", conversationId);

  return NextResponse.json({
    message,
    warning: "Message logged as queued. Live outbound send requires approved Meta messaging permissions.",
  });
}
