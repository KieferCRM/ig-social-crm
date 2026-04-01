import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";

type EventRow = {
  id: string;
  created_at: string;
  mode: "dev" | "meta";
  status: "processed" | "deduped" | "failed" | "ignored";
  meta_message_id: string | null;
  meta_participant_id: string | null;
  reason: string | null;
};

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("meta_webhook_events")
    .select("id,created_at,mode,status,meta_message_id,meta_participant_id,reason")
    .eq("agent_id", auth.context.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({
        events: [],
        summary: { last_24h: { processed: 0, deduped: 0, failed: 0, ignored: 0 } },
        warning: "Source health history is not available yet.",
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as EventRow[];
  const cutoff = Date.now() - 24 * 3600_000;
  const summary = { processed: 0, deduped: 0, failed: 0, ignored: 0 };

  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    if (row.status in summary) {
      const key = row.status as keyof typeof summary;
      summary[key] += 1;
    }
  }

  return NextResponse.json({
    events: rows,
    summary: { last_24h: summary },
  });
}
