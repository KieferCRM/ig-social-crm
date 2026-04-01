import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readEmailConfig } from "@/lib/email/credentials";
import { syncInbox } from "@/lib/email/imap";

export const dynamic = "force-dynamic";

// Cron: sync inbox for all agents that have email connected
// Run every 15 minutes via vercel.json cron
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? ""}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // Get all agents with email_config in settings
  const { data: agents, error } = await admin
    .from("agents")
    .select("id, settings");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const agent of agents ?? []) {
    const config = readEmailConfig(agent.settings as Record<string, unknown> | null);
    if (!config) { skipped++; continue; }

    try {
      const result = await syncInbox(agent.id as string, config, admin, 30);
      synced += result.synced;
      if (result.errors.length > 0) errors.push(`agent ${agent.id as string}: ${result.errors[0]}`);
    } catch (err) {
      errors.push(`agent ${agent.id as string}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, synced, skipped, errors: errors.slice(0, 10) });
}
