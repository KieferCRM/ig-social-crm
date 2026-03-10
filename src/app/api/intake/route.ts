import { NextResponse } from "next/server";
import { getClientIp, parseJsonBody } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeConsent } from "@/lib/consent";
import { withReminderOwnerColumn } from "@/lib/reminders";
import {
  isCoreQuestionField,
  readQuestionnaireFromAgentSettings,
  type QuestionnaireConfig,
} from "@/lib/questionnaire";

type IntakeBody = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  ig_username?: string | null;
  external_id?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  location_area?: string | null;
  contact_preference?: string | null;
  next_step?: string | null;
  tags?: string | null;
  notes?: string | null;
  source?: string | null;
  stage?: string | null;
  lead_temp?: string | null;
  website?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  consent_to_email?: boolean | string | null;
  consent_to_sms?: boolean | string | null;
  consent_source?: string | null;
  consent_timestamp?: string | null;
  consent_text_snapshot?: string | null;
  questionnaire_answers?: Record<string, unknown> | null;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function syntheticIgUsername(identity: string): string {
  return `intake_lead_${shortHash(identity)}`;
}

function normalizeSourceChannel(value: string | null): string | null {
  const source = (value || "").trim().toLowerCase();
  if (!source) return null;
  if (source === "ig" || source.includes("instagram")) return "ig";
  if (source === "fb" || source.includes("facebook")) return "fb";
  if (source.includes("webform") || source.includes("intake")) return "webform";
  if (source.includes("website") || source.includes("site")) return "website";
  if (source.includes("email")) return "email";
  if (source.includes("phone") || source.includes("call") || source.includes("sms") || source.includes("text")) return "phone";
  return "other";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function optionalAnswerString(value: unknown): string | null {
  if (typeof value === "string") return optionalString(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function parseIntakeAgentId(): string | null {
  return optionalString(process.env.INTAKE_AGENT_ID || null);
}

async function loadAgentQuestionnaireConfig(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string
): Promise<QuestionnaireConfig> {
  const { data } = await admin
    .from("agents")
    .select("settings")
    .eq("id", agentId)
    .maybeSingle();

  return readQuestionnaireFromAgentSettings(data?.settings || null);
}

const ALLOWED_STAGES = new Set(["New", "Contacted", "Qualified", "Closed"]);
const ALLOWED_TEMPS = new Set(["Cold", "Warm", "Hot"]);
const INTAKE_MAX_BODY_BYTES = 64 * 1024;
const INTAKE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await takeRateLimit({
    key: `intake:${ip}`,
    limit: INTAKE_RATE_LIMIT.limit,
    windowMs: INTAKE_RATE_LIMIT.windowMs,
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

  const intakeAgentId = parseIntakeAgentId();
  if (!intakeAgentId) {
    return NextResponse.json(
      { error: "Intake destination is not configured. Set INTAKE_AGENT_ID." },
      { status: 500 }
    );
  }
  if (!isUuid(intakeAgentId)) {
    return NextResponse.json(
      { error: "Intake destination is invalid. INTAKE_AGENT_ID must be a UUID." },
      { status: 500 }
    );
  }

  const admin = supabaseAdmin();
  const parsedBody = await parseJsonBody<IntakeBody>(request, {
    maxBytes: INTAKE_MAX_BODY_BYTES,
  });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.data;

  const honeypot = optionalString(body.website);
  if (honeypot) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const questionnaireConfig = await loadAgentQuestionnaireConfig(admin, intakeAgentId);
  const questionnaireAnswers = asRecord(body.questionnaire_answers);
  const resolvedInput: IntakeBody = { ...body };
  const customQuestionnaireFields: Record<string, string> = {};

  if (questionnaireAnswers) {
    for (const question of questionnaireConfig.questions) {
      const answer = optionalAnswerString(questionnaireAnswers[question.id]);
      if (!answer) continue;

      if (isCoreQuestionField(question.crm_field)) {
        const fieldKey = question.crm_field as keyof IntakeBody;
        const existingValue = optionalString(
          resolvedInput[fieldKey] as string | null | undefined
        );
        if (!existingValue) {
          resolvedInput[fieldKey] = answer;
        }
        continue;
      }

      if (question.crm_field.startsWith("custom.")) {
        const customKey = question.crm_field.slice("custom.".length).trim();
        if (customKey) {
          customQuestionnaireFields[customKey] = answer;
        }
      }
    }
  }

  const ig = normalizeHandle(optionalString(resolvedInput.ig_username) || "");
  const email = normalizeEmail(optionalString(resolvedInput.email) || "");
  const phone = normalizePhone(optionalString(resolvedInput.phone) || "");
  const externalId = (optionalString(resolvedInput.external_id) || "").toLowerCase();
  const firstName = optionalString(resolvedInput.first_name) || "";
  const lastName = optionalString(resolvedInput.last_name) || "";
  const fullName = optionalString(resolvedInput.full_name) || "";
  const displayName = fullName || `${firstName} ${lastName}`.trim();
  const identity =
    (ig ? `ig_${ig}` : "") ||
    (email ? `email_${email}` : "") ||
    (phone ? `phone_${phone}` : "") ||
    (externalId ? `ext_${externalId}` : "") ||
    (displayName ? `name_${displayName.toLowerCase()}` : "");

  if (!identity) {
    return NextResponse.json(
      { error: "Please provide at least one identity field (name, email, phone, IG)." },
      { status: 400 }
    );
  }

  const stage = optionalString(resolvedInput.stage) || "New";
  if (!ALLOWED_STAGES.has(stage)) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }

  const leadTemp = optionalString(resolvedInput.lead_temp) || "Warm";
  if (!ALLOWED_TEMPS.has(leadTemp)) {
    return NextResponse.json({ error: "Invalid lead temperature." }, { status: 400 });
  }

  const source = optionalString(resolvedInput.source) || "website_intake";
  const sourceChannel = normalizeSourceChannel(source);
  const resolvedIg = ig || syntheticIgUsername(identity);

  const sourceDetail: Record<string, string> = {};
  if (firstName) sourceDetail.first_name = firstName;
  if (lastName) sourceDetail.last_name = lastName;
  if (fullName) sourceDetail.full_name = fullName;
  if (email) sourceDetail.email = email;
  if (phone) sourceDetail.phone = phone;
  if (optionalString(resolvedInput.tags)) sourceDetail.tags = optionalString(resolvedInput.tags) as string;
  if (externalId) sourceDetail.external_id = externalId;
  if (optionalString(resolvedInput.utm_source))
    sourceDetail.utm_source = optionalString(resolvedInput.utm_source) as string;
  if (optionalString(resolvedInput.utm_medium))
    sourceDetail.utm_medium = optionalString(resolvedInput.utm_medium) as string;
  if (optionalString(resolvedInput.utm_campaign))
    sourceDetail.utm_campaign = optionalString(resolvedInput.utm_campaign) as string;
  sourceDetail.intake_identity = identity;

  const { data: existingLead } = await admin
    .from("leads")
    .select("id, custom_fields")
    .eq("agent_id", intakeAgentId)
    .eq("ig_username", resolvedIg)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const consent = normalizeConsent({
    source,
    consent_to_email: resolvedInput.consent_to_email,
    consent_to_sms: resolvedInput.consent_to_sms,
    consent_source: resolvedInput.consent_source,
    consent_timestamp: resolvedInput.consent_timestamp,
    consent_text_snapshot: resolvedInput.consent_text_snapshot,
    nowIso,
  });

  const payload: Record<string, unknown> = {
    agent_id: intakeAgentId,
    owner_user_id: intakeAgentId,
    assignee_user_id: intakeAgentId,
    ig_username: resolvedIg,
    stage,
    lead_temp: leadTemp,
    source,
    time_last_updated: nowIso,
    latest_source_method: "api",
    first_source_method: "api",
    source_confidence: ig || email || phone ? "exact" : "unknown",
    source_detail: sourceDetail,
    raw_email: email || null,
    raw_phone: phone || null,
    canonical_email: email || null,
    canonical_phone: phone || null,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || displayName || null,
    source_ref_id: externalId || null,
    consent_to_email: consent.consent_to_email,
    consent_to_sms: consent.consent_to_sms,
    consent_source: consent.consent_source,
    consent_timestamp: consent.consent_timestamp,
    consent_text_snapshot: consent.consent_text_snapshot,
  };

  const intent = optionalString(resolvedInput.intent);
  const timeline = optionalString(resolvedInput.timeline);
  const notes = optionalString(resolvedInput.notes);
  const budgetRange = optionalString(resolvedInput.budget_range);
  const locationArea = optionalString(resolvedInput.location_area);
  const contactPreference = optionalString(resolvedInput.contact_preference);
  const nextStep = optionalString(resolvedInput.next_step);
  if (intent) payload.intent = intent;
  if (timeline) payload.timeline = timeline;
  if (notes) payload.notes = notes;
  if (budgetRange) payload.budget_range = budgetRange;
  if (locationArea) payload.location_area = locationArea;
  if (contactPreference) payload.contact_preference = contactPreference;
  if (nextStep) payload.next_step = nextStep;
  if (sourceChannel) {
    payload.first_source_channel = sourceChannel;
    payload.latest_source_channel = sourceChannel;
  }

  const existingCustomFields = asRecord(existingLead?.custom_fields) || {};
  if (Object.keys(customQuestionnaireFields).length > 0) {
    payload.custom_fields = {
      ...existingCustomFields,
      ...customQuestionnaireFields,
    };
  }

  const { data: upsertedLead, error: upsertError } = await admin
    .from("leads")
    .upsert(payload, { onConflict: "agent_id,ig_username" })
    .select("id")
    .single();

  if (upsertError || !upsertedLead?.id) {
    return NextResponse.json(
      { error: upsertError?.message || "Could not ingest lead." },
      { status: 500 }
    );
  }

  const intakeEventRows: Array<Record<string, unknown>> = [];
  const occurredAt = new Date().toISOString();
  if (!existingLead?.id) {
    intakeEventRows.push({
      lead_id: upsertedLead.id,
      agent_id: intakeAgentId,
      event_type: "created",
      event_data: {
        source,
        source_ref_id: externalId || null,
        method: "intake_form",
      },
      actor_id: null,
      created_at: occurredAt,
    });
  }
  intakeEventRows.push({
    lead_id: upsertedLead.id,
    agent_id: intakeAgentId,
    event_type: "ingested",
    event_data: {
      source,
      source_ref_id: externalId || null,
      method: "intake_form",
      source_channel: sourceChannel,
    },
    actor_id: null,
    created_at: occurredAt,
  });
  const { error: eventInsertError } = await admin.from("lead_events").insert(intakeEventRows);
  if (eventInsertError) {
    console.warn("[intake] lead_events insert failed", { error: eventInsertError.message });
  }

  let reminderCreated = false;
  const dueAt = new Date(Date.now() + 24 * 3600_000).toISOString();

  const { data: existingReminder, error: checkReminderError } = await withReminderOwnerColumn((ownerColumn) =>
    admin
      .from("follow_up_reminders")
      .select("id")
      .eq(ownerColumn, intakeAgentId)
      .eq("lead_id", upsertedLead.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()
  );

  if (!checkReminderError && !existingReminder) {
    const { error: reminderError } = await withReminderOwnerColumn((ownerColumn) =>
      admin
        .from("follow_up_reminders")
        .insert({
          [ownerColumn]: intakeAgentId,
          lead_id: upsertedLead.id,
          conversation_id: null,
          due_at: dueAt,
          status: "pending",
          note: "New intake lead follow-up",
          preset: "1d",
        })
    );
    reminderCreated = !reminderError;
  }

  return NextResponse.json({
    ok: true,
    status: existingLead?.id ? "updated" : "inserted",
    lead_id: upsertedLead.id,
    reminder_created: reminderCreated,
  });
}
