import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getClientIp, readTextBody } from "@/lib/http";
import { ingestEnvelopeSchema } from "@/lib/ingest/schema";
import {
  deriveExternalEventId,
  derivePayloadHash,
  enqueueIngestionEvent,
  processIngestionEventById,
} from "@/lib/ingest/processor";
import { takeRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INGEST_MAX_BODY_BYTES = 256 * 1024;
const INGEST_AGENT_RATE_LIMIT = { limit: 100, windowMs: 60_000 };
const INGEST_IP_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const INGEST_TIMESTAMP_SKEW_SEC = 5 * 60;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeSource(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "unknown";
}

function safeTrim(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function timingSafeEqualHex(expectedHex: string, receivedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

function verifyHmacSignature(input: {
  rawBody: string;
  timestamp: string;
  signatureHeader: string;
  secret: string;
}): boolean {
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");

  const normalized = input.signatureHeader.startsWith("sha256=")
    ? input.signatureHeader.slice("sha256=".length)
    : input.signatureHeader;

  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;
  return timingSafeEqualHex(expected, normalized.toLowerCase());
}

function validateTimestamp(timestampRaw: string): boolean {
  const value = Number(timestampRaw);
  if (!Number.isFinite(value)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - Math.floor(value)) <= INGEST_TIMESTAMP_SKEW_SEC;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source: sourceParam } = await params;
  const source = normalizeSource(sourceParam);

  const ip = getClientIp(request);
  const ipRate = await takeRateLimit({
    key: `ingest:ip:${source}:${ip}`,
    limit: INGEST_IP_RATE_LIMIT.limit,
    windowMs: INGEST_IP_RATE_LIMIT.windowMs,
  });

  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipRate.retryAfterSec),
          "X-RateLimit-Remaining": String(ipRate.remaining),
        },
      }
    );
  }

  const body = await readTextBody(request, { maxBytes: INGEST_MAX_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const agentId = safeTrim(request.headers.get("x-agent-id"));
  if (!agentId || !isUuid(agentId)) {
    return NextResponse.json({ error: "Missing or invalid x-agent-id header." }, { status: 400 });
  }

  const agentRate = await takeRateLimit({
    key: `ingest:agent:${source}:${agentId}`,
    limit: INGEST_AGENT_RATE_LIMIT.limit,
    windowMs: INGEST_AGENT_RATE_LIMIT.windowMs,
  });

  if (!agentRate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(agentRate.retryAfterSec),
          "X-RateLimit-Remaining": String(agentRate.remaining),
        },
      }
    );
  }

  const timestamp = safeTrim(request.headers.get("x-ingest-timestamp"));
  if (!timestamp || !validateTimestamp(timestamp)) {
    return NextResponse.json({ error: "Invalid or stale x-ingest-timestamp." }, { status: 401 });
  }

  const signature = safeTrim(request.headers.get("x-ingest-signature"));
  if (!signature) {
    return NextResponse.json({ error: "Missing x-ingest-signature header." }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: agent, error: agentError } = await admin
    .from("agents")
    .select("webhook_secret")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  const secret = safeTrim(agent?.webhook_secret) || safeTrim(process.env.INGEST_WEBHOOK_SECRET || null);
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured for agent." }, { status: 401 });
  }

  const signatureValid = verifyHmacSignature({
    rawBody: body.raw,
    timestamp,
    signatureHeader: signature,
    secret,
  });

  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const parsedRaw = parseJsonObject(body.raw);
  if (!parsedRaw) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const validated = ingestEnvelopeSchema.safeParse(parsedRaw);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: "Payload validation failed.",
        details: validated.error.flatten(),
      },
      { status: 400 }
    );
  }

  const explicitEventId =
    safeTrim(request.headers.get("x-external-event-id")) ||
    safeTrim(validated.data.external_event_id || null);

  const externalEventId = deriveExternalEventId(body.raw, explicitEventId);
  const payloadHash = derivePayloadHash(body.raw);

  let enqueue;
  try {
    enqueue = await enqueueIngestionEvent({
      admin,
      agentId,
      source,
      externalEventId,
      payloadHash,
      rawPayload: parsedRaw,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not enqueue ingestion event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!enqueue.inserted) {
    return NextResponse.json({
      ok: true,
      deduped: true,
      event_id: enqueue.eventId,
      status: enqueue.status,
    });
  }

  // Fire-and-forget async processing after durable insert.
  void processIngestionEventById(admin, enqueue.eventId).catch((error) => {
    console.error("[ingest] async process failed", {
      eventId: enqueue.eventId,
      error: error instanceof Error ? error.message : "unknown",
    });
  });

  return NextResponse.json(
    {
      ok: true,
      queued: true,
      event_id: enqueue.eventId,
      status: "received",
    },
    { status: 202 }
  );
}
