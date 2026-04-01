import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type Params = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { conversationId } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

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

  const { data: messages, error: messageError } = await supabase
    .from("messages")
    .select("id, meta_message_id, direction, text, ts, created_at")
    .eq("conversation_id", conversationId)
    .order("ts", { ascending: true });

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}
