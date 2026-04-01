import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { ACCOUNT_TYPE_VALUES, type AccountType, type OnboardingStep } from "@/lib/onboarding";
import { parseJsonBody } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestBody = {
  event_name?: string;
  step?: string;
  account_type?: string | null;
  status?: string | null;
  surface?: string | null;
  metadata?: Record<string, unknown> | null;
  occurred_at?: string | null;
  idempotency_key?: string | null;
};

const ONBOARDING_EVENT_NAMES = new Set([
  "step_view",
  "step_complete",
  "onboarding_complete",
]);

const ONBOARDING_STEPS: OnboardingStep[] = [
  "account_type",
  "profile",
  "slug",
  "social",
  "complete",
];

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOccurredAt(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function hashPayload(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = await parseJsonBody<RequestBody>(request, { maxBytes: 4096 });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const eventName = optionalString(parsed.data.event_name);
  const step = optionalString(parsed.data.step);
  const accountType = optionalString(parsed.data.account_type);
  const status = optionalString(parsed.data.status);
  const surface = optionalString(parsed.data.surface);
  const occurredAt = parseOccurredAt(optionalString(parsed.data.occurred_at));

  if (!eventName || !ONBOARDING_EVENT_NAMES.has(eventName)) {
    return NextResponse.json({ error: "event_name is required." }, { status: 400 });
  }

  if (!step || !isOnboardingStep(step)) {
    return NextResponse.json({ error: "step is required." }, { status: 400 });
  }

  if (accountType && !(ACCOUNT_TYPE_VALUES as readonly string[]).includes(accountType)) {
    return NextResponse.json({ error: "Invalid account_type." }, { status: 400 });
  }

  const externalEventId =
    optionalString(parsed.data.idempotency_key) ||
    `${eventName}:${step}:${auth.context.user.id}:${randomUUID()}`;
  const payloadHash = hashPayload(parsed.raw);

  const { error } = await supabase.from("ingestion_events").insert({
    agent_id: auth.context.user.id,
    source: "onboarding",
    external_event_id: externalEventId,
    payload_hash: payloadHash,
    status: "processed",
    attempt_count: 0,
    raw_payload: {
      event_name: eventName,
      step,
      account_type: accountType,
      status,
      surface,
      metadata: parsed.data.metadata ?? {},
      occurred_at: occurredAt,
    },
    processed_at: occurredAt,
  });

  if (error) {
    console.warn("[onboarding.events] telemetry insert failed", { error: error.message });
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true });
}
