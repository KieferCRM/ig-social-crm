import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type Params = {
  params: Promise<{ conversationId: string }>;
};

type ReplyBody = {
  text?: string;
};

function syntheticMetaMessageId(conversationId: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `local_${conversationId}_${stamp}_${rand}`;
}

export async function POST(request: Request, { params }: Params) {
  const { conversationId } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsedBody = await parseJsonBody<ReplyBody>(request, { maxBytes: 16 * 1024 });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const text = (parsedBody.data.text || "").trim();
  if (!text) return NextResponse.json({ error: "Reply text is required." }, { status: 400 });

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(ownerFilter(auth.context))
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }
  if (!conversation?.id) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const ts = new Date().toISOString();

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      agent_id: auth.context.user.id,
      conversation_id: conversationId,
      meta_message_id: syntheticMetaMessageId(conversationId),
      direction: "out",
      text,
      ts,
      raw_json: { queued_locally: true, source: "crm_reply" },
    })
    .select("id,direction,text,ts,created_at")
    .single();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: ts, updated_at: ts })
    .eq("id", conversationId)
    .or(ownerFilter(auth.context));

  return NextResponse.json({
    message,
    warning: "Queued in CRM timeline. External send bridge is not configured yet.",
  });
}
