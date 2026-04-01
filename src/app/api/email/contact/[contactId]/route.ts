import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await params;

  const { data, error } = await supabase
    .from("agent_emails")
    .select("id, direction, from_address, to_address, subject, body_text, received_at, attachments")
    .eq("agent_id", user.id)
    .eq("contact_id", contactId)
    .order("received_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ emails: data ?? [] });
}
