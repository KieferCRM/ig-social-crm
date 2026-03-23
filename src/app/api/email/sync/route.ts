import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readEmailConfig } from "@/lib/email/credentials";
import { syncInbox } from "@/lib/email/imap";

export const dynamic = "force-dynamic";

// POST — manually trigger inbox sync for the current user
export async function POST() {
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
    return NextResponse.json({ error: "No email account connected." }, { status: 400 });
  }

  const result = await syncInbox(user.id, config, supabase, 50);

  return NextResponse.json({ ok: true, synced: result.synced, errors: result.errors });
}
