import { NextResponse } from "next/server";
import { getClientIp, parseJsonBody } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { normalizeConsent } from "@/lib/consent";
import { normalizeTimeframeBucket } from "@/lib/inbound";
import { supabaseServer } from "@/lib/supabase/server";
import { runChiefOrchestrator } from "@/lib/orchestrator/index";
import { applyDecision } from "@/lib/orchestrator/apply";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";

type IdentityBody = {
  email?: string | null;
  phone?: string | null;
  ig_username?: string | null;
  fb_username?: string | null;
  external_id?: string | null;
  full_name?: string | null;
};

type IntentBody = {
  text?: string | null;
  intent_type?: string | null;
  location_interest?: string | null;
  timeline_window?: string | null;
  budget_min?: number | string | null;
  budget_max?: number | string | null;
};

type EventIngestBody = {
  idempotency_key?: string | null;
  source?: string | null;
  channel?: string | null;
  event_type?: string | null;
  occurred_at?: string | null;
  lead_id?: string | null;
  identity?: IdentityBody | null;
  intent?: IntentBody | null;
  message_text?: string | null;
  confidence?: number | string | null;
  raw_payload?: Record<string, unknown> | null;
  normalized_payload?: Record<string, unknown> | null;
};

type IdentityFragment = {
  fragment_type: "email" | "phone" | "ig" | "fb" | "external_id" | "name";
  fragment_value: string;
  fragment_normalized: string;
  confidence: number;
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

function optionalNumber(value: number | string | null | undefined): number | null {
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
  if (["website", "site", "web", "form", "webform"].some((token) => key.includes(token))) return "website";
  if (["sms", "text", "iMessage", "imessage"].some((token) => key.includes(token.toLowerCase()))) return "sms";
  if (key.includes("email")) return "email";
  if (key.includes("instagram") || key === "ig") return "instagram";
  if (key.includes("facebook") || key === "fb") return "facebook";
  if (key.includes("phone") || key.includes("call")) return "phone";
  if (key.includes("referral") || key.includes("referrer")) return "referral";
  if (key.includes("appointment") || key.includes("showing") || key.includes("booking")) return "appointment";
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

function syntheticIgUsername(prefix: string, identity: string): string {
  const base = slugify(identity).slice(0, 40) || "lead";
  return `${prefix}_${base}_${shortHash(identity)}`;
}

function deriveEventIdempotencyKey(
  body: EventIngestBody,
  rawPayload: Record<string, unknown>,
  normalizedPayload: Record<string, unknown>
): string | null {
  const explicit = optionalString(body.idempotency_key);
  if (explicit) return explicit;

  const fromRaw =
    optionalString(rawPayload.idempotency_key) ||
    optionalString(rawPayload.event_id) ||
    optionalString(rawPayload.message_id) ||
    optionalString(rawPayload.external_message_id);
  if (fromRaw) return fromRaw;

  const fromNormalized =
    optionalString(normalizedPayload.idempotency_key) ||
    optionalString(normalizedPayload.event_id) ||
    optionalString(normalizedPayload.message_id);
  if (fromNormalized) return fromNormalized;

  return null;
}

function parseOccurredAt(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
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

  if (/\b(under|below|max|up to|at most)\b/.test(normalized)) {
    return { min: null, max: values[0] || null };
  }

  if (/\b(over|above|min|at least)\b/.test(normalized)) {
    return { min: values[0] || null, max: null };
  }

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

function clampConfidence(value: number | null, fallback: number): number {
  if (value === null) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 1000) / 1000;
}

function buildIdentityFragments(identity: IdentityBody | null | undefined): IdentityFragment[] {
  const data = identity || {};
  const fragments: IdentityFragment[] = [];

  const email = optionalString(data.email);
  if (email) {
    fragments.push({
      fragment_type: "email",
      fragment_value: email,
      fragment_normalized: normalizeEmail(email),
      confidence: 1,
    });
  }

  const phone = optionalString(data.phone);
  if (phone) {
    fragments.push({
      fragment_type: "phone",
      fragment_value: phone,
      fragment_normalized: normalizePhone(phone),
      confidence: 1,
    });
  }

  const ig = optionalString(data.ig_username);
  if (ig) {
    fragments.push({
      fragment_type: "ig",
      fragment_value: ig,
      fragment_normalized: normalizeHandle(ig),
      confidence: 0.95,
    });
  }

  const fb = optionalString(data.fb_username);
  if (fb) {
    fragments.push({
      fragment_type: "fb",
      fragment_value: fb,
      fragment_normalized: normalizeHandle(fb),
      confidence: 0.95,
    });
  }

  const externalId = optionalString(data.external_id);
  if (externalId) {
    fragments.push({
      fragment_type: "external_id",
      fragment_value: externalId,
      fragment_normalized: normalizeText(externalId),
      confidence: 0.9,
    });
  }

  const fullName = optionalString(data.full_name);
  if (fullName) {
    fragments.push({
      fragment_type: "name",
      fragment_value: fullName,
      fragment_normalized: normalizeText(fullName),
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

function isMissingRelationError(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

const EVENTS_INGEST_MAX_BODY_BYTES = 256 * 1024;
const EVENTS_INGEST_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Load operator path from workspace settings
  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  const workspaceSettings = readWorkspaceSettingsFromAgentSettings(agentRow?.settings);
  const operatorPath = workspaceSettings.operator_path;

  const ip = getClientIp(request);
  const rate = await takeRateLimit({
    key: `events_ingest:${auth.context.user.id}:${ip}`,
    limit: EVENTS_INGEST_RATE_LIMIT.limit,
    windowMs: EVENTS_INGEST_RATE_LIMIT.windowMs,
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
  const parsedBody = await parseJsonBody<EventIngestBody>(request, {
    maxBytes: EVENTS_INGEST_MAX_BODY_BYTES,
  });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.data;

  const eventType = optionalString(body.event_type);
  if (!eventType) {
    return NextResponse.json({ error: "event_type is required." }, { status: 400 });
  }

  const source = optionalString(body.source) || "manual";
  const channel = normalizeChannel(optionalString(body.channel));
  const rawPayload = asRecord(body.raw_payload);
  const existingNormalizedPayload = asRecord(body.normalized_payload);
  const idempotencyKey = deriveEventIdempotencyKey(body, rawPayload, existingNormalizedPayload);

  if (idempotencyKey) {
    const nowIso = new Date().toISOString();
    const { data: keyRow, error: keyError } = await supabase
      .from("lead_ingest_keys")
      .upsert(
        {
          agent_id: auth.context.user.id,
          owner_user_id: auth.context.user.id,
          source,
          idempotency_key: idempotencyKey,
          last_seen_at: nowIso,
        },
        { onConflict: "agent_id,source,idempotency_key" }
      )
      .select("event_id")
      .single();

    if (keyError && !isMissingRelationError(keyError)) {
      return NextResponse.json({ error: keyError.message }, { status: 500 });
    }

    if (keyRow?.event_id) {
      return NextResponse.json({
        ok: true,
        deduped: true,
        event_id: keyRow.event_id,
      });
    }
  }

  let leadId = optionalString(body.lead_id);
  const identity = body.identity || null;
  const fragments = buildIdentityFragments(identity);

  if (!leadId && fragments.length === 0) {
    return NextResponse.json(
      { error: "Provide lead_id or at least one identity fragment (email, phone, ig_username, fb_username, external_id, full_name)." },
      { status: 400 }
    );
  }

  if (leadId) {
    const { data: leadAccess, error: leadAccessError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .or(ownerFilter(auth.context, "owner_user_id"))
      .maybeSingle();

    if (leadAccessError) {
      return NextResponse.json({ error: leadAccessError.message }, { status: 500 });
    }
    if (!leadAccess?.id) {
      return NextResponse.json({ error: "lead_id is not accessible." }, { status: 404 });
    }
  }

  const ownerOrTeam = `owner_user_id.eq.${auth.context.user.id}`;

  let personId: string | null = null;

  if (leadId) {
    const { data: personByLead, error: personByLeadError } = await supabase
      .from("lead_people")
      .select("id")
      .eq("lead_id", leadId)
      .or(ownerOrTeam)
      .limit(1)
      .maybeSingle();

    if (personByLeadError) {
      if (isMissingRelationError(personByLeadError)) {
        return NextResponse.json({ error: "lead intelligence schema is missing. Run step20 SQL migration." }, { status: 500 });
      }
      return NextResponse.json({ error: personByLeadError.message }, { status: 500 });
    }

    personId = personByLead?.id || null;
  }

  if (!personId) {
    for (const fragment of fragments) {
      const { data: fragmentMatch, error: fragmentError } = await supabase
        .from("lead_identity_fragments")
        .select("person_id")
        .eq("fragment_type", fragment.fragment_type)
        .eq("fragment_normalized", fragment.fragment_normalized)
        .or(ownerOrTeam)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fragmentError) {
        if (isMissingRelationError(fragmentError)) {
          return NextResponse.json({ error: "lead intelligence schema is missing. Run step20 SQL migration." }, { status: 500 });
        }
        return NextResponse.json({ error: fragmentError.message }, { status: 500 });
      }

      if (fragmentMatch?.person_id) {
        personId = fragmentMatch.person_id;
        break;
      }
    }
  }

  const displayName = optionalString(identity?.full_name);
  const canonicalEmail = fragments.find((fragment) => fragment.fragment_type === "email")?.fragment_normalized || null;
  const canonicalPhone = fragments.find((fragment) => fragment.fragment_type === "phone")?.fragment_normalized || null;
  const canonicalHandle =
    fragments.find((fragment) => fragment.fragment_type === "ig")?.fragment_normalized ||
    fragments.find((fragment) => fragment.fragment_type === "fb")?.fragment_normalized ||
    null;

  if (!leadId && personId) {
    const { data: personLead, error: personLeadError } = await supabase
      .from("lead_people")
      .select("lead_id")
      .eq("id", personId)
      .or(ownerOrTeam)
      .maybeSingle();

    if (personLeadError && !isMissingRelationError(personLeadError)) {
      return NextResponse.json({ error: personLeadError.message }, { status: 500 });
    }

    leadId = optionalString(personLead?.lead_id);
  }

  if (!leadId && canonicalHandle) {
    const { data: matchedLead, error: matchedLeadError } = await supabase
      .from("leads")
      .select("id")
      .eq("ig_username", canonicalHandle)
      .or(ownerFilter(auth.context, "owner_user_id"))
      .limit(1)
      .maybeSingle();

    if (matchedLeadError) {
      return NextResponse.json({ error: matchedLeadError.message }, { status: 500 });
    }

    leadId = matchedLead?.id || null;
  }

  if (!leadId) {
    const externalId = optionalString(identity?.external_id);
    const seedIdentity =
      canonicalHandle ||
      canonicalEmail ||
      canonicalPhone ||
      externalId ||
      displayName ||
      `event_${auth.context.user.id.slice(0, 8)}_${Date.now()}`;
    const igUsername = canonicalHandle || syntheticIgUsername("event", seedIdentity);
    const leadChannel = normalizeLeadChannel(channel);
    const sourceDetail: Record<string, string> = { ingest_event_type: eventType };
    if (canonicalEmail) sourceDetail.email = canonicalEmail;
    if (canonicalPhone) sourceDetail.phone = canonicalPhone;
    if (displayName) sourceDetail.full_name = displayName;
    if (externalId) sourceDetail.external_id = externalId;

    const nowIso = new Date().toISOString();
    const consent = normalizeConsent({
      source,
      consent_to_email:
        rawPayload.consent_to_email ?? existingNormalizedPayload.consent_to_email,
      consent_to_sms:
        rawPayload.consent_to_sms ?? existingNormalizedPayload.consent_to_sms,
      consent_source:
        optionalString(rawPayload.consent_source) ||
        optionalString(existingNormalizedPayload.consent_source) ||
        source,
      consent_timestamp:
        optionalString(rawPayload.consent_timestamp) ||
        optionalString(existingNormalizedPayload.consent_timestamp),
      consent_text_snapshot:
        optionalString(rawPayload.consent_text_snapshot) ||
        optionalString(existingNormalizedPayload.consent_text_snapshot),
      nowIso,
    });

    const { data: upsertedLead, error: leadUpsertError } = await supabase
      .from("leads")
      .upsert(
        {
          agent_id: auth.context.user.id,
          owner_user_id: auth.context.user.id,
          assignee_user_id: auth.context.user.id,
          ig_username: igUsername,
          stage: "New",
          lead_temp: "Warm",
          source: source,
          first_source_channel: leadChannel,
          latest_source_channel: leadChannel,
          first_source_method: "api",
          latest_source_method: "api",
          source_confidence: canonicalHandle ? "exact" : "inferred",
          source_detail: sourceDetail,
          raw_email: canonicalEmail,
          raw_phone: canonicalPhone,
          canonical_email: canonicalEmail,
          canonical_phone: canonicalPhone,
          full_name: displayName,
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
      return NextResponse.json({ error: leadUpsertError?.message || "Could not create lead for event." }, { status: 500 });
    }
    leadId = upsertedLead.id;
  }

  if (!personId) {
    const { data: insertedPerson, error: insertPersonError } = await supabase
      .from("lead_people")
      .insert({
        agent_id: auth.context.user.id,
        owner_user_id: auth.context.user.id,
        lead_id: leadId,
        display_name: displayName,
        canonical_email: canonicalEmail,
        canonical_phone: canonicalPhone,
        canonical_handle: canonicalHandle,
        resolution_confidence: fragments.length >= 2 ? 0.95 : 0.8,
      })
      .select("id")
      .single();

    if (insertPersonError || !insertedPerson?.id) {
      if (isMissingRelationError(insertPersonError)) {
        return NextResponse.json({ error: "lead intelligence schema is missing. Run step20 SQL migration." }, { status: 500 });
      }
      return NextResponse.json({ error: insertPersonError?.message || "Could not resolve person." }, { status: 500 });
    }

    personId = insertedPerson.id;
  } else {
    await supabase
      .from("lead_people")
      .update({ lead_id: leadId, canonical_email: canonicalEmail, canonical_phone: canonicalPhone, canonical_handle: canonicalHandle })
      .eq("id", personId)
      .or(ownerOrTeam);
  }

  const messageText =
    optionalString(body.message_text) ||
    optionalString(body.intent?.text) ||
    optionalString(typeof existingNormalizedPayload.message_text === "string" ? existingNormalizedPayload.message_text : null);

  const inferredIntentType = messageText ? extractIntentType(messageText) : null;
  const inferredTimelineWindow = messageText ? extractTimeline(messageText) : null;
  const inferredLocation = messageText ? extractLocation(messageText) : null;
  const inferredBudget = messageText ? extractBudget(messageText) : { min: null, max: null };

  const intentType = optionalString(body.intent?.intent_type) || inferredIntentType;
  const locationInterest = optionalString(body.intent?.location_interest) || inferredLocation;
  const timelineWindow = optionalString(body.intent?.timeline_window) || inferredTimelineWindow;
  const budgetMin = optionalNumber(body.intent?.budget_min) ?? inferredBudget.min;
  const budgetMax = optionalNumber(body.intent?.budget_max) ?? inferredBudget.max;

  const confidence = clampConfidence(optionalNumber(body.confidence), messageText ? 0.82 : 0.65);

  const normalizedIdentity: Record<string, string> = {};
  for (const fragment of fragments) {
    normalizedIdentity[fragment.fragment_type] = fragment.fragment_normalized;
  }

  const normalizedPayload = {
    ...existingNormalizedPayload,
    event_type: eventType,
    source,
    channel,
    idempotency_key: idempotencyKey,
    intent_type: intentType,
    location_interest: locationInterest,
    timeline_window: timelineWindow,
    budget_min: budgetMin,
    budget_max: budgetMax,
    identity: normalizedIdentity,
  };

  const occurredAt = parseOccurredAt(optionalString(body.occurred_at));

  const { data: eventRow, error: eventError } = await supabase
    .from("lead_signal_events")
    .insert({
      agent_id: auth.context.user.id,
      owner_user_id: auth.context.user.id,
      lead_id: leadId,
      person_id: personId,
      source,
      channel,
      event_type: eventType,
      occurred_at: occurredAt,
      identity: normalizedIdentity,
      raw_payload: rawPayload,
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
    if (isMissingRelationError(eventError)) {
      return NextResponse.json({ error: "lead intelligence schema is missing. Run step20 SQL migration." }, { status: 500 });
    }
    return NextResponse.json({ error: eventError?.message || "Could not store signal event." }, { status: 500 });
  }

  if (idempotencyKey) {
    const { error: keyFinalizeError } = await supabase
      .from("lead_ingest_keys")
      .update({
        lead_id: leadId,
        event_id: eventRow.id,
        last_seen_at: new Date().toISOString(),
      })
      .eq("agent_id", auth.context.user.id)
      .eq("source", source)
      .eq("idempotency_key", idempotencyKey);

    if (keyFinalizeError && !isMissingRelationError(keyFinalizeError)) {
      console.warn("[events.ingest] idempotency finalize failed", {
        error: keyFinalizeError.message,
      });
    }
  }

  for (const fragment of fragments) {
    const { error: fragmentUpsertError } = await supabase
      .from("lead_identity_fragments")
      .upsert(
        {
          agent_id: auth.context.user.id,
          owner_user_id: auth.context.user.id,
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

    if (fragmentUpsertError) {
      return NextResponse.json({ error: fragmentUpsertError.message }, { status: 500 });
    }
  }

  let intentSignalId: string | null = null;
  const hasIntentSignal = Boolean(intentType || locationInterest || timelineWindow || budgetMin !== null || budgetMax !== null);

  if (hasIntentSignal) {
    const { data: intentRow, error: intentError } = await supabase
      .from("lead_intent_signals")
      .insert({
        agent_id: auth.context.user.id,
        owner_user_id: auth.context.user.id,
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

  // Detect preferred channel from form/event data
  const preferredChannel = (() => {
    const raw =
      optionalString(body.normalized_payload?.preferred_channel as unknown) ||
      optionalString(body.raw_payload?.preferred_channel as unknown);
    if (raw === "call" || raw === "text" || raw === "email") return raw as "call" | "text" | "email";
    return null;
  })();

  const decision = await runChiefOrchestrator({
    lead: {
      id: leadId!,
      full_name: optionalString(identity?.full_name),
      stage: "New",
      source,
      created_at: occurredAt,
    },
    event: {
      type: eventType,
      channel: optionalString(body.channel),
      message_text: messageText,
    },
    contact: {
      has_phone: Boolean(canonicalPhone),
      has_email: Boolean(canonicalEmail),
      preferred_channel: preferredChannel,
    },
    intent: {
      intent_type: intentType,
      timeline_window: timelineWindow,
      location_interest: locationInterest,
      budget_min: budgetMin,
      budget_max: budgetMax,
      property_address: optionalString(
        (body.intent as Record<string, unknown> | null | undefined)?.property_address
      ),
    },
    path: operatorPath,
    open_tasks: [],
  });

  const { recommendation_id: recommendationId } = await applyDecision(
    decision,
    leadId!,
    personId,
    eventRow.id,
    auth.context.user.id,
    supabase
  );

  return NextResponse.json({
    ok: true,
    deduped: false,
    event_id: eventRow.id,
    lead_id: leadId,
    person_id: personId,
    intent_signal_id: intentSignalId,
    recommendation_id: recommendationId,
  });
}
