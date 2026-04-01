import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function countRowsByStatus(status: "received" | "failed" | "dlq", olderThanIso?: string) {
  const admin = supabaseAdmin();
  let query = admin
    .from("ingestion_events")
    .select("id", { count: "exact", head: true })
    .eq("status", status);

  if (olderThanIso) {
    query = query.lt("created_at", olderThanIso);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return count || 0;
}

export async function GET() {
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();
  const olderThanIso = new Date(Date.now() - 5 * 60_000).toISOString();
  const admin = supabaseAdmin();

  try {
    const { error: dbError } = await admin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (dbError) {
      throw new Error(dbError.message);
    }

    const [received, failed, dlq, stuckReceived] = await Promise.all([
      countRowsByStatus("received"),
      countRowsByStatus("failed"),
      countRowsByStatus("dlq"),
      countRowsByStatus("received", olderThanIso),
    ]);

    return NextResponse.json(
      {
        ok: true,
        checked_at: nowIso,
        db: "ok",
        ingestion_queue: {
          received,
          failed,
          dlq,
          received_older_than_5m: stuckReceived,
        },
        alerts: {
          has_dlq: dlq > 0,
          has_stuck_received: stuckReceived > 0,
        },
        response_ms: Date.now() - startedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed.";
    return NextResponse.json(
      {
        ok: false,
        checked_at: nowIso,
        db: "error",
        error: message,
        response_ms: Date.now() - startedAt,
      },
      { status: 503 }
    );
  }
}
