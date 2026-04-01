import { NextResponse } from "next/server";
import { processPendingIngestionEvents } from "@/lib/ingest/processor";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeTrim(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function isAuthorized(request: Request): boolean {
  const expected = safeTrim(process.env.INGEST_PROCESSOR_SECRET || null);
  if (!expected) return false;

  const provided =
    safeTrim(request.headers.get("x-ingest-processor-secret")) ||
    safeTrim(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null);

  if (!provided) return false;
  return provided === expected;
}

function parseLimit(request: Request): number {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("limit") || "25");
  if (!Number.isFinite(raw)) return 25;
  return Math.max(1, Math.min(200, Math.round(raw)));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const admin = supabaseAdmin();
  const limit = parseLimit(request);

  try {
    const result = await processPendingIngestionEvents(admin, limit);
    return NextResponse.json({ ok: true, ...result, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process ingestion queue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
