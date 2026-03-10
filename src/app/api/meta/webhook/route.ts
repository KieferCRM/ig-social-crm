import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { normalizeConsent } from "@/lib/consent";
import { getClientIp, readTextBody } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { withReminderOwnerColumn } from "@/lib/reminders";

type NormalizedEvent = {
  agent_id: string;
  platform: "ig" | "fb";
  meta_thread_id: string;
  meta_message_id: string;
  meta_participant_id: string;
  direction: "in" | "out";
  text: string | null;
  ts: string;
  raw: unknown;
};

type DevPayload = {
  platform: "ig" | "fb";
  meta_thread_id: string;
  meta_message_id: string;
  meta_participant_id: string;
  direction: "in" | "out";
  text?: string;
  ts?: string;
  raw?: unknown;
};

type MetaMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string };
};

type MetaEntry = {
  id?: string;
  messaging?: MetaMessagingEvent[];
};

type WebhookMode = "dev" | "meta";
type WebhookStatus = "processed" | "deduped" | "failed" | "ignored";

type WebhookEventLogInput = {
  agent_id: string | null;
  mode: WebhookMode;
  status: WebhookStatus;
  signature_valid: boolean | null;
  meta_message_id?: string | null;
  meta_thread_id?: string | null;
  meta_participant_id?: string | null;
  reason?: string | null;
  payload?: unknown;
};

type LeadRow = {
  id: string;
  stage: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  budget_range: string | null;
  location_area: string | null;
  contact_preference: string | null;
  next_step: string | null;
  last_qualification_bucket_asked: string | null;
};

type SettingsRow = {
  intent_enabled: boolean;
  intent_question: string;
  timeline_enabled: boolean;
  timeline_question: string;
  budget_range_enabled: boolean;
  budget_range_question: string;
  location_area_enabled: boolean;
  location_area_question: string;
  contact_preference_enabled: boolean;
  contact_preference_question: string;
  next_step_enabled: boolean;
  next_step_question: string;
  completion_message: string;
};

const DEFAULT_SETTINGS: SettingsRow = {
  intent_enabled: true,
  intent_question: "What are you looking for exactly (buy/sell/invest)?",
  timeline_enabled: true,
  timeline_question: "What is your ideal timeline to move?",
  budget_range_enabled: true,
  budget_range_question: "What budget range are you targeting?",
  location_area_enabled: true,
  location_area_question: "Which location or neighborhood is best for you?",
  contact_preference_enabled: true,
  contact_preference_question: "How do you prefer we stay in touch?",
  next_step_enabled: true,
  next_step_question: "What is the best next step for you right now?",
  completion_message: "Great, you are qualified. I can help with next steps now.",
};

const BUCKETS: Array<{ key: keyof LeadRow; enabled: keyof SettingsRow; question: keyof SettingsRow }> = [
  { key: "intent", enabled: "intent_enabled", question: "intent_question" },
  { key: "timeline", enabled: "timeline_enabled", question: "timeline_question" },
  { key: "budget_range", enabled: "budget_range_enabled", question: "budget_range_question" },
  { key: "location_area", enabled: "location_area_enabled", question: "location_area_question" },
  { key: "contact_preference", enabled: "contact_preference_enabled", question: "contact_preference_question" },
  { key: "next_step", enabled: "next_step_enabled", question: "next_step_question" },
];
const META_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;
const META_WEBHOOK_RATE_LIMIT = { limit: 360, windowMs: 60_000 };
const META_WEBHOOK_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isLocalHost(request: Request): boolean {
  const headerHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  const host = (headerHost || "").split(":")[0]?.toLowerCase() || "";
  return host === "localhost" || host === "127.0.0.1";
}

function allowDevImpersonation(request: Request): boolean {
  return (
    process.env.META_WEBHOOK_DEV_HEADER_ENABLED === "true" &&
    isLocalHost(request)
  );
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function parseDevPayload(body: unknown): DevPayload | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;

  const platform = value.platform === "ig" || value.platform === "fb" ? value.platform : null;
  const direction = value.direction === "in" || value.direction === "out" ? value.direction : null;

  if (
    !platform ||
    !direction ||
    typeof value.meta_thread_id !== "string" ||
    typeof value.meta_message_id !== "string" ||
    typeof value.meta_participant_id !== "string"
  ) {
    return null;
  }

  return {
    platform,
    meta_thread_id: value.meta_thread_id,
    meta_message_id: value.meta_message_id,
    meta_participant_id: value.meta_participant_id,
    direction,
    text: typeof value.text === "string" ? value.text : "",
    ts: typeof value.ts === "string" ? value.ts : undefined,
    raw: value.raw,
  };
}

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function isFreshIsoTimestamp(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return Math.abs(Date.now() - parsed) <= META_WEBHOOK_TIMESTAMP_SKEW_MS;
}

function isFreshUnixMsTimestamp(value: number | undefined): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(Date.now() - Number(value)) <= META_WEBHOOK_TIMESTAMP_SKEW_MS;
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function createAutoMessageId(inboundMessageId: string, suffix: string): string {
  return `auto_${inboundMessageId}_${suffix}`;
}

function cleanReason(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 450 ? `${value.slice(0, 447)}...` : value;
}

async function logWebhookEvent(
  admin: ReturnType<typeof createAdminClient>,
  input: WebhookEventLogInput
) {
  const payload =
    input.payload === undefined
      ? null
      : JSON.parse(JSON.stringify(input.payload));

  const { error } = await admin.from("meta_webhook_events").insert({
    agent_id: input.agent_id,
    mode: input.mode,
    status: input.status,
    signature_valid: input.signature_valid,
    meta_message_id: input.meta_message_id ?? null,
    meta_thread_id: input.meta_thread_id ?? null,
    meta_participant_id: input.meta_participant_id ?? null,
    reason: cleanReason(input.reason),
    payload,
  });

  if (error && error.code !== "42P01") {
    console.warn("[meta.webhook] event log insert failed", { error: error.message });
  }
}

async function loadSettings(admin: ReturnType<typeof createAdminClient>, agentId: string): Promise<SettingsRow> {
  const { data, error } = await admin
    .from("qualification_settings")
    .select(
      "intent_enabled,intent_question,timeline_enabled,timeline_question,budget_range_enabled,budget_range_question,location_area_enabled,location_area_question,contact_preference_enabled,contact_preference_question,next_step_enabled,next_step_question,completion_message"
    )
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...data } as SettingsRow;
}

async function loadLead(admin: ReturnType<typeof createAdminClient>, agentId: string, handle: string): Promise<LeadRow | null> {
  const normalizedHandle = normalizeHandle(handle);
  const { data, error } = await admin
    .from("leads")
    .select(
      "id,stage,source,intent,timeline,budget_range,location_area,contact_preference,next_step,last_qualification_bucket_asked"
    )
    .eq("agent_id", agentId)
    .eq("ig_username", normalizedHandle)
    .maybeSingle();

  if (error) return null;
  return (data as LeadRow | null) || null;
}

async function createFollowUpReminder(
  admin: ReturnType<typeof createAdminClient>,
  event: NormalizedEvent,
  leadId: string | null,
  conversationId: string
) {
  if (!leadId) return;

  const { data: existing } = await withReminderOwnerColumn((ownerColumn) =>
    admin
      .from("follow_up_reminders")
      .select("id")
      .eq(ownerColumn, event.agent_id)
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()
  );

  if (existing?.id) return;

  const dueAt = new Date(Date.now() + 24 * 3600_000).toISOString();

  const { error } = await withReminderOwnerColumn((ownerColumn) =>
    admin.from("follow_up_reminders").insert({
      [ownerColumn]: event.agent_id,
      lead_id: leadId,
      conversation_id: conversationId,
      due_at: dueAt,
      status: "pending",
      preset: "1d",
      note: "Automated follow-up reminder",
    })
  );

  if (error) {
    console.error("[meta.webhook] create reminder failed", { error: error.message });
  }
}

async function runQualificationAutomation(
  admin: ReturnType<typeof createAdminClient>,
  event: NormalizedEvent,
  conversationId: string,
  lead: LeadRow | null
) {
  if (!lead || event.direction !== "in") {
    return;
  }

  const settings = await loadSettings(admin, event.agent_id);
  const text = (event.text || "").trim();

  if (lead.last_qualification_bucket_asked && text) {
    const askedKey = lead.last_qualification_bucket_asked as keyof LeadRow;
    if (["intent", "timeline", "budget_range", "location_area", "contact_preference", "next_step"].includes(askedKey)) {
      const update: Record<string, string | null> = {
        last_qualification_bucket_asked: null,
        time_last_updated: new Date().toISOString(),
      };
      if (!lead[askedKey]) {
        update[askedKey] = text;
      }

      await admin.from("leads").update(update).eq("id", lead.id);
      lead = await loadLead(admin, event.agent_id, event.meta_participant_id);
      if (!lead) return;
    }
  }

  const missing = BUCKETS.find((bucket) => {
    const enabled = Boolean(settings[bucket.enabled]);
    const value = lead?.[bucket.key] as string | null;
    return enabled && (!value || value.trim() === "");
  });

  if (missing) {
    const question = String(settings[missing.question] || "").trim();
    if (!question) return;

    await admin.from("messages").upsert(
      {
        agent_id: event.agent_id,
        conversation_id: conversationId,
        meta_message_id: createAutoMessageId(event.meta_message_id, String(missing.key)),
        direction: "out",
        text: question,
        ts: new Date().toISOString(),
        raw_json: { automated: true, type: "qualification_question", bucket: missing.key },
      },
      { onConflict: "agent_id,meta_message_id", ignoreDuplicates: true }
    );

    await admin
      .from("leads")
      .update({
        last_qualification_bucket_asked: String(missing.key),
        time_last_updated: new Date().toISOString(),
      })
      .eq("id", lead.id);

    return;
  }

  if (lead.stage !== "Qualified") {
    await admin
      .from("leads")
      .update({ stage: "Qualified", last_qualification_bucket_asked: null, time_last_updated: new Date().toISOString() })
      .eq("id", lead.id);

    await admin.from("messages").upsert(
      {
        agent_id: event.agent_id,
        conversation_id: conversationId,
        meta_message_id: createAutoMessageId(event.meta_message_id, "completion"),
        direction: "out",
        text: settings.completion_message,
        ts: new Date().toISOString(),
        raw_json: { automated: true, type: "qualification_complete" },
      },
      { onConflict: "agent_id,meta_message_id", ignoreDuplicates: true }
    );

    await createFollowUpReminder(admin, event, lead.id, conversationId);
  }
}

async function ingestEvent(admin: ReturnType<typeof createAdminClient>, event: NormalizedEvent) {
  const participantHandle = normalizeHandle(event.meta_participant_id);

  const { data: existingMessage, error: existingMessageError } = await admin
    .from("messages")
    .select("id, conversation_id")
    .eq("agent_id", event.agent_id)
    .eq("meta_message_id", event.meta_message_id)
    .maybeSingle();

  if (existingMessageError) {
    throw new Error(existingMessageError.message);
  }

  if (existingMessage?.id) {
    return {
      conversation_id: existingMessage.conversation_id,
      message_id: existingMessage.id,
      lead_id: null,
      deduped: true,
    };
  }

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .upsert(
      {
        agent_id: event.agent_id,
        platform: event.platform,
        meta_thread_id: event.meta_thread_id,
        meta_participant_id: participantHandle,
        last_message_at: event.ts,
      },
      { onConflict: "agent_id,platform,meta_thread_id" }
    )
    .select("id")
    .single();

  if (conversationError || !conversation) {
    throw new Error(conversationError?.message || "Conversation upsert failed.");
  }

  const { data: messageRows, error: messageError } = await admin
    .from("messages")
    .upsert(
      {
        agent_id: event.agent_id,
        conversation_id: conversation.id,
        meta_message_id: event.meta_message_id,
        direction: event.direction,
        text: event.text,
        ts: event.ts,
        raw_json: event.raw ?? {},
      },
      { onConflict: "agent_id,meta_message_id", ignoreDuplicates: true }
    )
    .select("id");

  if (messageError) {
    throw new Error(messageError.message);
  }

  const insertedMessageId = messageRows?.[0]?.id ?? null;
  if (!insertedMessageId) {
    throw new Error("Message insert failed.");
  }

  const nowIso = new Date().toISOString();

  const { data: existingLead } = await admin
    .from("leads")
    .select("id, source, stage, first_source_channel, latest_source_channel")
    .eq("agent_id", event.agent_id)
    .eq("ig_username", participantHandle)
    .maybeSingle();

  const source = existingLead?.source?.trim()
    ? existingLead.source
    : event.platform === "ig"
    ? "IG DM"
    : "FB DM";

  const stage = existingLead?.stage?.trim() ? existingLead.stage : "New";
  const consent = normalizeConsent({
    source,
    consent_source: source,
    nowIso,
  });

  const { data: leadRows, error: leadError } = await admin
    .from("leads")
    .upsert(
      {
        agent_id: event.agent_id,
        owner_user_id: event.agent_id,
        assignee_user_id: event.agent_id,
        ig_username: participantHandle,
        canonical_email: null,
        canonical_phone: null,
        source_ref_id: event.meta_participant_id,
        source,
        first_source_channel:
          existingLead?.first_source_channel || (event.platform === "ig" ? "ig" : "fb"),
        latest_source_channel: event.platform === "ig" ? "ig" : "fb",
        first_source_method: existingLead?.first_source_channel ? undefined : "webhook",
        latest_source_method: "webhook",
        source_confidence: "exact",
        first_touch_at: event.ts,
        first_touch_message_id: event.meta_message_id,
        stage,
        consent_to_email: consent.consent_to_email,
        consent_to_sms: consent.consent_to_sms,
        consent_source: consent.consent_source,
        consent_timestamp: consent.consent_timestamp,
        consent_text_snapshot: consent.consent_text_snapshot,
        custom_fields: {},
        last_message_preview: event.text,
        time_last_updated: nowIso,
      },
      { onConflict: "agent_id,ig_username" }
    )
    .select("id")
    .limit(1);

  if (leadError) {
    throw new Error(leadError.message);
  }

  const leadId = leadRows?.[0]?.id ?? existingLead?.id ?? null;

  const { error: conversationUpdateError } = await admin
    .from("conversations")
    .update({ last_message_at: event.ts })
    .eq("id", conversation.id);

  if (conversationUpdateError) {
    throw new Error(conversationUpdateError.message);
  }

  const fullLead = await loadLead(admin, event.agent_id, participantHandle);
  await runQualificationAutomation(admin, event, conversation.id, fullLead);

  return {
    conversation_id: conversation.id,
    message_id: insertedMessageId,
    lead_id: leadId,
    deduped: false,
  };
}

async function resolveAgentId(
  admin: ReturnType<typeof createAdminClient>,
  businessIdCandidates: string[]
): Promise<string | null> {
  if (businessIdCandidates.length === 0) return null;

  const { data, error } = await admin
    .from("meta_tokens")
    .select("agent_id, meta_user_id")
    .in("meta_user_id", businessIdCandidates)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[meta.webhook] resolve-agent failed", {
      error: error.message,
      candidates: businessIdCandidates,
    });
    return null;
  }

  return data?.agent_id ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && challenge && verifyToken && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[meta.webhook.verify] failed", {
    mode,
    has_token: Boolean(token),
    has_challenge: Boolean(challenge),
  });

  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await takeRateLimit({
    key: `meta_webhook:${ip}`,
    limit: META_WEBHOOK_RATE_LIMIT.limit,
    windowMs: META_WEBHOOK_RATE_LIMIT.windowMs,
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

  try {
    const admin = createAdminClient();
    const rawBodyResult = await readTextBody(request, {
      maxBytes: META_WEBHOOK_MAX_BODY_BYTES,
    });
    if (!rawBodyResult.ok) {
      await logWebhookEvent(admin, {
        agent_id: null,
        mode: "meta",
        status: "failed",
        signature_valid: null,
        reason: rawBodyResult.error,
      });
      return NextResponse.json({ error: rawBodyResult.error }, { status: rawBodyResult.status });
    }
    const rawBody = rawBodyResult.raw;

    const devAgentId = request.headers.get("x-agent-id");
    const devModeEnabled = allowDevImpersonation(request);
    const signature = request.headers.get("x-hub-signature-256");
    const hasValidSignature = verifySignature(rawBody, signature);

    if (isProduction() && !hasValidSignature && !(devModeEnabled && devAgentId)) {
      console.warn("[meta.webhook] rejected unsigned request in production");
      await logWebhookEvent(admin, {
        agent_id: null,
        mode: "meta",
        status: "failed",
        signature_valid: false,
        reason: "Invalid webhook signature in production.",
      });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    if (devModeEnabled && devAgentId) {
      let devBody: unknown;
      try {
        devBody = JSON.parse(rawBody);
      } catch {
        await logWebhookEvent(admin, {
          agent_id: devAgentId,
          mode: "dev",
          status: "failed",
          signature_valid: hasValidSignature,
          reason: "Invalid JSON payload for dev webhook mode.",
          payload: rawBody,
        });
        return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
      }

      const parsed = parseDevPayload(devBody);
      if (!parsed) {
        await logWebhookEvent(admin, {
          agent_id: devAgentId,
          mode: "dev",
          status: "failed",
          signature_valid: hasValidSignature,
          reason: "Invalid dev payload format.",
          payload: devBody,
        });
        return NextResponse.json({ error: "Invalid dev payload format." }, { status: 400 });
      }

      const normalizedEvent: NormalizedEvent = {
        agent_id: devAgentId,
        platform: parsed.platform,
        meta_thread_id: parsed.meta_thread_id,
        meta_message_id: parsed.meta_message_id,
        meta_participant_id: parsed.meta_participant_id,
        direction: parsed.direction,
        text: parsed.text ?? null,
        ts: parsed.ts ?? new Date().toISOString(),
        raw: parsed.raw ?? {},
      };

      if (!isFreshIsoTimestamp(normalizedEvent.ts)) {
        await logWebhookEvent(admin, {
          agent_id: devAgentId,
          mode: "dev",
          status: "failed",
          signature_valid: hasValidSignature,
          meta_message_id: normalizedEvent.meta_message_id,
          meta_thread_id: normalizedEvent.meta_thread_id,
          meta_participant_id: normalizedEvent.meta_participant_id,
          reason: "Stale or invalid webhook timestamp.",
          payload: normalizedEvent.raw,
        });
        return NextResponse.json({ error: "Invalid or stale webhook timestamp." }, { status: 401 });
      }

      try {
        const result = await ingestEvent(admin, normalizedEvent);
        await logWebhookEvent(admin, {
          agent_id: devAgentId,
          mode: "dev",
          status: result.deduped ? "deduped" : "processed",
          signature_valid: hasValidSignature,
          meta_message_id: normalizedEvent.meta_message_id,
          meta_thread_id: normalizedEvent.meta_thread_id,
          meta_participant_id: normalizedEvent.meta_participant_id,
        });

        return NextResponse.json({ ok: true, mode: "dev", ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Webhook processing failed.";
        await logWebhookEvent(admin, {
          agent_id: devAgentId,
          mode: "dev",
          status: "failed",
          signature_valid: hasValidSignature,
          meta_message_id: normalizedEvent.meta_message_id,
          meta_thread_id: normalizedEvent.meta_thread_id,
          meta_participant_id: normalizedEvent.meta_participant_id,
          reason: message,
          payload: normalizedEvent.raw,
        });
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (!hasValidSignature) {
      await logWebhookEvent(admin, {
        agent_id: null,
        mode: "meta",
        status: "failed",
        signature_valid: false,
        reason: "Invalid webhook signature.",
      });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    let payload: { object?: string; entry?: MetaEntry[] };
    try {
      payload = JSON.parse(rawBody) as { object?: string; entry?: MetaEntry[] };
    } catch {
      await logWebhookEvent(admin, {
        agent_id: null,
        mode: "meta",
        status: "failed",
        signature_valid: true,
        reason: "Invalid JSON payload.",
        payload: rawBody,
      });
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const objectType = payload.object;
    if (objectType !== "instagram" && objectType !== "page") {
      await logWebhookEvent(admin, {
        agent_id: null,
        mode: "meta",
        status: "ignored",
        signature_valid: true,
        reason: `Unsupported webhook object type: ${objectType || "unknown"}.`,
        payload,
      });
      return NextResponse.json({ ok: true, mode: "meta", ignored: true });
    }
    const platform: "ig" | "fb" = objectType === "instagram" ? "ig" : "fb";

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (!isFreshUnixMsTimestamp(event.timestamp)) {
          await logWebhookEvent(admin, {
            agent_id: null,
            mode: "meta",
            status: "failed",
            signature_valid: true,
            reason: "Stale or invalid webhook timestamp.",
            payload: event,
          });
          return NextResponse.json({ error: "Invalid or stale webhook timestamp." }, { status: 401 });
        }
      }
    }

    const results: Array<{
      conversation_id: string;
      message_id: string | null;
      lead_id: string | null;
      deduped: boolean;
    }> = [];
    let failed = 0;
    let ignored = 0;

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;
        const mid = event.message?.mid;

        if (!senderId || !recipientId || !mid) {
          ignored += 1;
          await logWebhookEvent(admin, {
            agent_id: null,
            mode: "meta",
            status: "ignored",
            signature_valid: true,
            reason: "Missing sender, recipient, or message id.",
            payload: event,
          });
          continue;
        }

        const direction: "in" | "out" = senderId === (entry.id || recipientId) ? "out" : "in";
        const participantId = direction === "in" ? senderId : recipientId;
        const threadId = [senderId, recipientId].sort().join(":");
        const timestamp =
          typeof event.timestamp === "number"
            ? new Date(event.timestamp).toISOString()
            : new Date().toISOString();

        const businessCandidates = [recipientId, senderId, entry.id].filter(
          (v): v is string => Boolean(v)
        );

        const agentId = await resolveAgentId(admin, businessCandidates);
        if (!agentId) {
          ignored += 1;
          await logWebhookEvent(admin, {
            agent_id: null,
            mode: "meta",
            status: "ignored",
            signature_valid: true,
            meta_message_id: mid,
            meta_thread_id: threadId,
            meta_participant_id: participantId,
            reason: "No matching agent found for Meta business account.",
            payload: { business_candidates: businessCandidates, event },
          });
          continue;
        }

        const normalizedEvent: NormalizedEvent = {
          agent_id: agentId,
          platform,
          meta_thread_id: threadId,
          meta_message_id: mid,
          meta_participant_id: participantId,
          direction,
          text: event.message?.text ?? null,
          ts: timestamp,
          raw: event,
        };

        try {
          const result = await ingestEvent(admin, normalizedEvent);
          results.push(result);

          await logWebhookEvent(admin, {
            agent_id: agentId,
            mode: "meta",
            status: result.deduped ? "deduped" : "processed",
            signature_valid: true,
            meta_message_id: mid,
            meta_thread_id: threadId,
            meta_participant_id: participantId,
          });
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Event ingest failed.";
          await logWebhookEvent(admin, {
            agent_id: agentId,
            mode: "meta",
            status: "failed",
            signature_valid: true,
            meta_message_id: mid,
            meta_thread_id: threadId,
            meta_participant_id: participantId,
            reason: message,
            payload: event,
          });
        }
      }
    }

    console.info("[meta.webhook] processed", {
      mode: "meta",
      processed: results.length,
      deduped: results.filter((r) => r.deduped).length,
      ignored,
      failed,
    });

    if (failed > 0) {
      return NextResponse.json(
        {
          error: "One or more webhook events failed to process.",
          mode: "meta",
          processed: results.length,
          deduped: results.filter((r) => r.deduped).length,
          ignored,
          failed,
          results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, mode: "meta", processed: results.length, results });
  } catch (error) {
    console.error("[meta.webhook] failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 }
    );
  }
}
