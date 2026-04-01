import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { normalizeConsent } from "@/lib/consent";
import { getClientIp, parseJsonBody } from "@/lib/http";
import { normalizeTimeframeBucket } from "@/lib/inbound";
import { takeRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

type IdentityFragment = {
  fragment_type: "email" | "phone" | "ig" | "fb" | "external_id" | "name";
  fragment_value: string;
  fragment_normalized: string;
  confidence: number;
};

type RecommendationDraft = {
  reason_code: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  metadata: Record<string, unknown>;
};

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function fromPath(record: Record<string, unknown>, path: string): unknown {
  const steps = path.split(".");
  let current: unknown = record;
  for (const step of steps) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[step];
  }
  return current;
}

function pickString(record: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const value = optionalString(fromPath(record, path));
    if (value) return value;
  }
  return null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeChannel(value: string | null): "website" | "sms" | "email" | "instagram" | "facebook" | "phone" | "referral" | "appointment" | "other" {
  const key = normalizeText(value || "");
  if (!key) return "other";
  if (key.includes("instagram") || key === "ig") return "instagram";
  if (key.includes("facebook") || key === "fb") return "facebook";
  if (key.includes("email")) return "email";
  if (key.includes("sms") || key.includes("text") || key.includes("whatsapp")) return "sms";
  if (key.includes("phone") || key.includes("call")) return "phone";
  if (key.includes("website") || key.includes("web")) return "website";
  if (key.includes("referral")) return "referral";
  if (key.includes("appointment") || key.includes("booking")) return "appointment";
  return "other";
}

function normalizeLeadChannel(
  value: ReturnType<typeof normalizeChannel>
): "ig" | "fb" | "webform" | "website" | "email" | "phone" | "manual" | "import_csv" | "other" {
  if (value === "instagram") return "ig";
  if (value === "facebook") return "fb";
  if (value === "website") return "website";
  if (value === "email") return "email";
  if (value === "phone" || value === "sms") return "phone";
  return "other";
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function syntheticIgUsername(identity: string): string {
  const base = slugify(identity).slice(0, 40) || "lead";
  return `manychat_${base}_${shortHash(identity)}`;
}

function parseOccurredAt(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function clampConfidence(value: number | null, fallback: number): number {
  if (value === null) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 1000) / 1000;
}

function extractBudget(text: string): { min: number | null; max: number | null } {
  const normalized = text.toLowerCase();
  const values: number[] = [];
  const pattern = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m)?/gi;

  let match = pattern.exec(text);
  while (match) {
    const raw = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(raw)) {
      const suffix = (match[2] || "").toLowerCase();
      const amount = suffix === "m" ? raw * 1_000_000 : suffix === "k" ? raw * 1_000 : raw;
      values.push(amount);
    }
    match = pattern.exec(text);
  }

  if (values.length === 0) return { min: null, max: null };
  if (/\b(under|below|max|up to|at most)\b/.test(normalized)) return { min: null, max: values[0] || null };
  if (/\b(over|above|min|at least)\b/.test(normalized)) return { min: values[0] || null, max: null };
  if (values.length >= 2 && /\b(to|through|between|-)\b/.test(normalized)) {
    const sorted = [...values].sort((a, b) => a - b);
    return { min: sorted[0] || null, max: sorted[1] || null };
  }
  return { min: null, max: values[0] || null };
}

function extractTimeline(text: string): string | null {
  return normalizeTimeframeBucket(text);
}

function extractLocation(text: string): string | null {
  const match = text.match(/(?:\bin\b|\baround\b|\bnear\b|\bat\b)\s+([a-zA-Z][a-zA-Z\s.'-]{1,60})(?:[,.!?]|$)/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function extractIntentType(text: string): string | null {
  const normalized = text.toLowerCase();
  const isBuyer = /\b(buy|buyer|purchase|looking for|house hunt|home search)\b/.test(normalized);
  const isSeller = /\b(sell|seller|listing|list my|list our|list your)\b/.test(normalized);
  const isInvestor = /\b(invest|investment|cashflow|cap rate|rental property)\b/.test(normalized);
  const isRenter = /\b(rent|lease|tenant)\b/.test(normalized);

  if (isBuyer && isSeller) return "buyer_seller";
  if (isInvestor) return "investor";
  if (isBuyer) return "buyer";
  if (isSeller) return "seller";
  if (isRenter) return "renter";
  return null;
}

function inferRecommendation(input: {
  eventType: string;
  intentType: string | null;
  timelineWindow: string | null;
  messageText: string | null;
}): RecommendationDraft | null {
  const lowerText = (input.messageText || "").toLowerCase();

  if (input.timelineWindow && input.timelineWindow.toLowerCase() === "asap") {
    return {
      reason_code: "urgent_timeline_signal",
      title: "Urgent move signal",
      description: "Lead signaled an immediate timeline. Prioritize same-day outreach.",
      priority: "urgent",
      due_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
      metadata: { timeline_window: input.timelineWindow, event_type: input.eventType },
    };
  }

  if (/\b(finance|financing|mortgage|pre-approval|preapproval)\b/.test(lowerText)) {
    return {
      reason_code: "financing_question_follow_up",
      title: "Financing follow-up needed",
      description: "Lead mentioned financing. Send financing guidance or lender intro.",
      priority: "high",
      due_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      metadata: { event_type: input.eventType, intent_type: input.intentType },
    };
  }

  return null;
}

function buildIdentityFragments(input: {
  email: string | null;
  phone: string | null;
  ig: string | null;
  fb: string | null;
  externalId: string | null;
  fullName: string | null;
}): IdentityFragment[] {
  const fragments: IdentityFragment[] = [];

  if (input.email) {
    fragments.push({
      fragment_type: "email",
      fragment_value: input.email,
      fragment_normalized: normalizeEmail(input.email),
      confidence: 1,
    });
  }

  if (input.phone) {
    fragments.push({
      fragment_type: "phone",
      fragment_value: input.phone,
      fragment_normalized: normalizePhone(input.phone),
      confidence: 1,
    });
  }

  if (input.ig) {
    fragments.push({
      fragment_type: "ig",
      fragment_value: input.ig,
      fragment_normalized: normalizeHandle(input.ig),
      confidence: 0.95,
    });
  }

  if (input.fb) {
    fragments.push({
      fragment_type: "fb",
      fragment_value: input.fb,
      fragment_normalized: normalizeHandle(input.fb),
      confidence: 0.95,
    });
  }

  if (input.externalId) {
    fragments.push({
      fragment_type: "external_id",
      fragment_value: input.externalId,
      fragment_normalized: normalizeText(input.externalId),
      confidence: 0.95,
    });
  }

  if (input.fullName) {
    fragments.push({
      fragment_type: "name",
      fragment_value: input.fullName,
      fragment_normalized: normalizeText(input.fullName),
      confidence: 0.6,
    });
  }

  const deduped = new Map<string, IdentityFragment>();
  for (const fragment of fragments) {
    const key = `${fragment.fragment_type}:${fragment.fragment_normalized}`;
    if (!deduped.has(key)) deduped.set(key, fragment);
  }

  return Array.from(deduped.values());
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function extractSecret(request: Request, payload: Record<string, unknown>): string | null {
  const fromHeader = optionalString(request.headers.get("x-manychat-secret"));
  if (fromHeader) return fromHeader;

  const auth = optionalString(request.headers.get("authorization"));
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return optionalString(auth.slice(7));
  }

  if (process.env.NODE_ENV !== "production") {
    const fromQuery = optionalString(new URL(request.url).searchParams.get("token"));
    if (fromQuery) return fromQuery;

    const fromBody = pickString(payload, ["secret", "webhook_secret", "token"]);
    if (fromBody) return fromBody;
  }

  return null;
}

function isMissingRelationError(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

function deriveManychatIdempotencyKey(
  payload: Record<string, unknown>,
  externalMessageId: string | null
): string {
  if (externalMessageId) return externalMessageId;
  const explicit = pickString(payload, ["idempotency_key", "event_id", "message.id", "message.mid"]);
  if (explicit) return explicit;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const MANYCHAT_MAX_BODY_BYTES = 256 * 1024;
const MANYCHAT_RATE_LIMIT = { limit: 240, windowMs: 60_000 };

export async function POST(request: Request) {
  const manychatEnabled = process.env.FEATURE_MANYCHAT_ENABLED === "true";
  if (!manychatEnabled) {
    return NextResponse.json(
      { error: "ManyChat webhook is disabled for this deployment." },
      { status: 503 }
    );
  }

  const ip = getClientIp(request);
  const rate = await takeRateLimit({
    key: `manychat_webhook:${ip}`,
    limit: MANYCHAT_RATE_LIMIT.limit,
    windowMs: MANYCHAT_RATE_LIMIT.windowMs,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      }
    );
  }

  const expectedSecret = optionalString(process.env.MANYCHAT_WEBHOOK_SECRET || null);
  const agentId = optionalString(process.env.MANYCHAT_AGENT_ID || null);

  if (!expectedSecret || !agentId) {
    return NextResponse.json(
      { error: "ManyChat integration is not configured. Set MANYCHAT_WEBHOOK_SECRET and MANYCHAT_AGENT_ID." },
      { status: 500 }
    );
  }

  const parsedBody = await parseJsonBody<Record<string, unknown>>(request, {
    maxBytes: MANYCHAT_MAX_BODY_BYTES,
  });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const payload = asRecord(parsedBody.data);

  const receivedSecret = extractSecret(request, payload);
  if (!receivedSecret || !timingSafeStringEqual(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Invalid ManyChat secret." }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const platform = pickString(payload, ["platform", "channel", "source_platform", "subscriber.platform"]);
  const eventType = pickString(payload, ["event_type", "event", "type"]) || "manychat_message";
  const occurredAt = parseOccurredAt(pickString(payload, ["occurred_at", "timestamp", "created_at", "time", "date"]));

  const messageText = pickString(payload, [
    "message_text",
    "text",
    "message",
    "message.text",
    "last_input_text",
    "input",
    "content.text",
    "data.message",
  ]);

  const email = pickString(payload, ["email", "subscriber.email", "contact.email", "user.email"]);
  const phone = pickString(payload, ["phone", "subscriber.phone", "contact.phone", "user.phone"]);
  const ig = pickString(payload, ["ig_username", "instagram.username", "subscriber.instagram", "user.instagram"]);
  const fb = pickString(payload, ["fb_username", "facebook.username", "subscriber.facebook", "user.facebook"]);
  const externalId = pickString(payload, ["external_id", "subscriber.id", "contact.id", "user.id", "manychat_subscriber_id"]);
  const fullName = pickString(payload, ["full_name", "name", "subscriber.name", "contact.name", "user.name"]);
  const leadIdFromPayload = pickString(payload, ["lead_id"]);
  const externalMessageId = pickString(payload, ["external_message_id", "message_id", "id", "event_id", "message.mid"]);
  const idempotencyKey = deriveManychatIdempotencyKey(payload, externalMessageId);

  const fragments = buildIdentityFragments({ email, phone, ig, fb, externalId, fullName });
  if (!leadIdFromPayload && fragments.length === 0) {
    return NextResponse.json(
      { error: "Need at least one identity field (email/phone/ig/fb/external_id/full_name) or lead_id." },
      { status: 400 }
    );
  }

  const { data: keyRow, error: keyError } = await admin
    .from("lead_ingest_keys")
    .upsert(
      {
        agent_id: agentId,
        owner_user_id: agentId,
        source: "manychat",
        idempotency_key: idempotencyKey,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,source,idempotency_key" }
    )
    .select("event_id")
    .single();

  if (keyError && !isMissingRelationError(keyError)) {
    return NextResponse.json({ error: keyError.message }, { status: 500 });
  }
  if (keyRow?.event_id) {
    return NextResponse.json({ ok: true, deduped: true, event_id: keyRow.event_id });
  }
  if (keyError && isMissingRelationError(keyError) && externalMessageId) {
    const { data: existingEvent, error: dedupeError } = await admin
      .from("lead_signal_events")
      .select("id")
      .eq("agent_id", agentId)
      .eq("source", "manychat")
      .contains("normalized_payload", { external_message_id: externalMessageId })
      .limit(1)
      .maybeSingle();

    if (dedupeError && !isMissingRelationError(dedupeError)) {
      return NextResponse.json({ error: dedupeError.message }, { status: 500 });
    }
    if (existingEvent?.id) {
      return NextResponse.json({ ok: true, deduped: true, event_id: existingEvent.id });
    }
  }

  let leadId = leadIdFromPayload;
  if (leadId) {
    const { data: leadAccess, error: leadAccessError } = await admin
      .from("leads")
      .select("id")
      .eq("agent_id", agentId)
      .eq("id", leadId)
      .limit(1)
      .maybeSingle();

    if (leadAccessError) {
      return NextResponse.json({ error: leadAccessError.message }, { status: 500 });
    }
    if (!leadAccess?.id) {
      return NextResponse.json({ error: "lead_id is not accessible." }, { status: 404 });
    }
  }

  if (!leadId && ig) {
    const { data: matchedLead } = await admin
      .from("leads")
      .select("id")
      .eq("agent_id", agentId)
      .eq("ig_username", normalizeHandle(ig))
      .limit(1)
      .maybeSingle();

    leadId = matchedLead?.id || null;
  }

  let personId: string | null = null;

  if (leadId) {
    const { data: personByLead, error: personByLeadError } = await admin
      .from("lead_people")
      .select("id")
      .eq("agent_id", agentId)
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();

    if (personByLeadError) {
      if (isMissingRelationError(personByLeadError)) {
        return NextResponse.json({ error: "Lead intelligence schema missing. Run step20 SQL migration." }, { status: 500 });
      }
      return NextResponse.json({ error: personByLeadError.message }, { status: 500 });
    }

    personId = personByLead?.id || null;
  }

  if (!personId) {
    for (const fragment of fragments) {
      const { data: fragmentMatch, error: fragmentError } = await admin
        .from("lead_identity_fragments")
        .select("person_id")
        .eq("agent_id", agentId)
        .eq("fragment_type", fragment.fragment_type)
        .eq("fragment_normalized", fragment.fragment_normalized)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fragmentError) {
        if (isMissingRelationError(fragmentError)) {
          return NextResponse.json({ error: "Lead intelligence schema missing. Run step20 SQL migration." }, { status: 500 });
        }
        return NextResponse.json({ error: fragmentError.message }, { status: 500 });
      }

      if (fragmentMatch?.person_id) {
        personId = fragmentMatch.person_id;
        break;
      }
    }
  }

  const canonicalEmail = fragments.find((item) => item.fragment_type === "email")?.fragment_normalized || null;
  const canonicalPhone = fragments.find((item) => item.fragment_type === "phone")?.fragment_normalized || null;
  const canonicalHandle =
    fragments.find((item) => item.fragment_type === "ig")?.fragment_normalized ||
    fragments.find((item) => item.fragment_type === "fb")?.fragment_normalized ||
    null;

  if (!leadId && personId) {
    const { data: personLead, error: personLeadError } = await admin
      .from("lead_people")
      .select("lead_id")
      .eq("agent_id", agentId)
      .eq("id", personId)
      .limit(1)
      .maybeSingle();
    if (personLeadError && !isMissingRelationError(personLeadError)) {
      return NextResponse.json({ error: personLeadError.message }, { status: 500 });
    }
    leadId = optionalString(personLead?.lead_id);
  }

  if (!leadId) {
    const seedIdentity = canonicalHandle || canonicalEmail || canonicalPhone || externalId || fullName || `manychat_${Date.now()}`;
    const resolvedHandle = canonicalHandle || syntheticIgUsername(seedIdentity);
    const leadChannel = normalizeLeadChannel(normalizeChannel(platform));
    const sourceDetail: Record<string, string> = {};
    if (canonicalEmail) sourceDetail.email = canonicalEmail;
    if (canonicalPhone) sourceDetail.phone = canonicalPhone;
    if (fullName) sourceDetail.full_name = fullName;
    if (externalId) sourceDetail.external_id = externalId;

    const nowIso = new Date().toISOString();
    const consent = normalizeConsent({
      source: "manychat",
      consent_source: "manychat",
      nowIso,
    });

    const { data: upsertedLead, error: leadUpsertError } = await admin
      .from("leads")
      .upsert(
        {
          agent_id: agentId,
          owner_user_id: agentId,
          assignee_user_id: agentId,
          ig_username: resolvedHandle,
          stage: "New",
          lead_temp: "Warm",
          source: "manychat",
          first_source_channel: leadChannel,
          latest_source_channel: leadChannel,
          first_source_method: "webhook",
          latest_source_method: "webhook",
          source_confidence: canonicalHandle ? "exact" : "inferred",
          source_detail: sourceDetail,
          raw_email: canonicalEmail,
          raw_phone: canonicalPhone,
          canonical_email: canonicalEmail,
          canonical_phone: canonicalPhone,
          full_name: fullName,
          source_ref_id: externalId,
          consent_to_email: consent.consent_to_email,
          consent_to_sms: consent.consent_to_sms,
          consent_source: consent.consent_source,
          consent_timestamp: consent.consent_timestamp,
          consent_text_snapshot: consent.consent_text_snapshot,
          custom_fields: {},
          time_last_updated: nowIso,
        },
        { onConflict: "agent_id,ig_username" }
      )
      .select("id")
      .single();

    if (leadUpsertError || !upsertedLead?.id) {
      return NextResponse.json({ error: leadUpsertError?.message || "Could not create lead for ManyChat event." }, { status: 500 });
    }
    leadId = upsertedLead.id;
  }

  if (!personId) {
    const { data: insertedPerson, error: insertPersonError } = await admin
      .from("lead_people")
      .insert({
        agent_id: agentId,
        owner_user_id: agentId,
        lead_id: leadId,
        display_name: fullName,
        canonical_email: canonicalEmail,
        canonical_phone: canonicalPhone,
        canonical_handle: canonicalHandle,
        resolution_confidence: fragments.length >= 2 ? 0.95 : 0.8,
      })
      .select("id")
      .single();

    if (insertPersonError || !insertedPerson?.id) {
      return NextResponse.json({ error: insertPersonError?.message || "Could not resolve person." }, { status: 500 });
    }
    personId = insertedPerson.id;
  } else if (leadId) {
    await admin
      .from("lead_people")
      .update({ lead_id: leadId, canonical_email: canonicalEmail, canonical_phone: canonicalPhone, canonical_handle: canonicalHandle })
      .eq("id", personId);
  }

  const inferredIntentType = messageText ? extractIntentType(messageText) : null;
  const inferredTimelineWindow = messageText ? extractTimeline(messageText) : null;
  const inferredLocation = messageText ? extractLocation(messageText) : null;
  const inferredBudget = messageText ? extractBudget(messageText) : { min: null, max: null };

  const intentType = pickString(payload, ["intent.intent_type", "intent_type"]) || inferredIntentType;
  const locationInterest = pickString(payload, ["intent.location_interest", "location_interest", "location"]) || inferredLocation;
  const timelineWindow = pickString(payload, ["intent.timeline_window", "timeline_window", "timeline_hint"]) || inferredTimelineWindow;
  const budgetMin = optionalNumber(fromPath(payload, "intent.budget_min")) ?? optionalNumber(fromPath(payload, "budget_min")) ?? inferredBudget.min;
  const budgetMax = optionalNumber(fromPath(payload, "intent.budget_max")) ?? optionalNumber(fromPath(payload, "budget_max")) ?? inferredBudget.max;

  const confidence = clampConfidence(optionalNumber(fromPath(payload, "confidence")), messageText ? 0.82 : 0.65);

  const normalizedIdentity: Record<string, string> = {};
  for (const fragment of fragments) {
    normalizedIdentity[fragment.fragment_type] = fragment.fragment_normalized;
  }

  const normalizedPayload = {
    source: "manychat",
    channel: normalizeChannel(platform),
    platform,
    event_type: eventType,
    external_message_id: externalMessageId,
    idempotency_key: idempotencyKey,
    external_subscriber_id: externalId,
    intent_type: intentType,
    location_interest: locationInterest,
    timeline_window: timelineWindow,
    budget_min: budgetMin,
    budget_max: budgetMax,
    identity: normalizedIdentity,
  };

  const { data: eventRow, error: eventError } = await admin
    .from("lead_signal_events")
    .insert({
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: leadId,
      person_id: personId,
      source: "manychat",
      channel: normalizeChannel(platform),
      event_type: eventType,
      occurred_at: occurredAt,
      identity: normalizedIdentity,
      raw_payload: payload,
      normalized_payload: normalizedPayload,
      message_text: messageText,
      intent_label: intentType,
      location_interest: locationInterest,
      timeline_hint: timelineWindow,
      price_min: budgetMin,
      price_max: budgetMax,
      confidence,
    })
    .select("id")
    .single();

  if (eventError || !eventRow?.id) {
    return NextResponse.json({ error: eventError?.message || "Could not store ManyChat event." }, { status: 500 });
  }

  const { error: keyFinalizeError } = await admin
    .from("lead_ingest_keys")
    .update({
      lead_id: leadId,
      event_id: eventRow.id,
      last_seen_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId)
    .eq("source", "manychat")
    .eq("idempotency_key", idempotencyKey);

  if (keyFinalizeError && !isMissingRelationError(keyFinalizeError)) {
    console.warn("[manychat.webhook] idempotency finalize failed", {
      error: keyFinalizeError.message,
    });
  }

  for (const fragment of fragments) {
    const { error: fragmentError } = await admin
      .from("lead_identity_fragments")
      .upsert(
        {
          agent_id: agentId,
          owner_user_id: agentId,
          person_id: personId,
          source_event_id: eventRow.id,
          fragment_type: fragment.fragment_type,
          fragment_value: fragment.fragment_value,
          fragment_normalized: fragment.fragment_normalized,
          confidence: fragment.confidence,
          first_seen_at: occurredAt,
          last_seen_at: occurredAt,
        },
        { onConflict: "agent_id,fragment_type,fragment_normalized" }
      );

    if (fragmentError) {
      return NextResponse.json({ error: fragmentError.message }, { status: 500 });
    }
  }

  let intentSignalId: string | null = null;
  const hasIntentSignal = Boolean(intentType || locationInterest || timelineWindow || budgetMin !== null || budgetMax !== null);

  if (hasIntentSignal) {
    const { data: intentRow, error: intentError } = await admin
      .from("lead_intent_signals")
      .insert({
        agent_id: agentId,
        owner_user_id: agentId,
        lead_id: leadId,
        person_id: personId,
        source_event_id: eventRow.id,
        intent_type: intentType,
        location_interest: locationInterest,
        timeline_window: timelineWindow,
        budget_min: budgetMin,
        budget_max: budgetMax,
        confidence,
        extracted_text: messageText,
      })
      .select("id")
      .single();

    if (intentError) {
      return NextResponse.json({ error: intentError.message }, { status: 500 });
    }
    intentSignalId = intentRow?.id || null;
  }

  let recommendationId: string | null = null;
  const recommendation = inferRecommendation({
    eventType,
    intentType,
    timelineWindow,
    messageText,
  });

  if (recommendation) {
    const { data: recommendationRow } = await admin
      .from("lead_recommendations")
      .insert({
        agent_id: agentId,
        owner_user_id: agentId,
        lead_id: leadId,
        person_id: personId,
        source_event_id: eventRow.id,
        reason_code: recommendation.reason_code,
        title: recommendation.title,
        description: recommendation.description,
        priority: recommendation.priority,
        due_at: recommendation.due_at,
        metadata: recommendation.metadata,
      })
      .select("id")
      .single();

    recommendationId = recommendationRow?.id || null;
  }

  return NextResponse.json({
    ok: true,
    source: "manychat",
    deduped: false,
    event_id: eventRow.id,
    person_id: personId,
    lead_id: leadId,
    intent_signal_id: intentSignalId,
    recommendation_id: recommendationId,
  });
}
