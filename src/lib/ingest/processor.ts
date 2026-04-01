import { createHash } from "crypto";
import { normalizeConsent } from "@/lib/consent";
import { ingestEnvelopeSchema, type IngestEnvelope } from "@/lib/ingest/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

type EnqueueInput = {
  admin: AdminClient;
  agentId: string;
  source: string;
  externalEventId: string;
  payloadHash: string;
  rawPayload: Record<string, unknown>;
};

type EnqueueResult =
  | { inserted: true; eventId: string }
  | { inserted: false; eventId: string; status: string };

type IngestionEventRow = {
  id: string;
  agent_id: string;
  source: string;
  external_event_id: string;
  status: string;
  attempt_count: number;
  raw_payload: unknown;
  updated_at: string;
  created_at: string;
};

type LeadRow = {
  id: string;
  agent_id: string;
  ig_username: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  source: string | null;
  source_ref_id: string | null;
  stage: string | null;
  lead_temp: string | null;
  consent_to_email: boolean | null;
  consent_to_sms: boolean | null;
  consent_source: string | null;
  consent_timestamp: string | null;
  consent_text_snapshot: string | null;
  tags: string[] | null;
  custom_fields: Record<string, unknown> | null;
};

type ProcessResult = {
  processed: number;
  failed: number;
  dlq: number;
};

function safeTrim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function normalizeHandle(value: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function normalizePhoneToE164(value: string | null): string | null {
  if (!value) return null;
  const input = value.trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (input.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

function syntheticHandle(source: string, identity: string): string {
  const base = identity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "lead";
  const h = createHash("sha256").update(identity).digest("hex").slice(0, 8);
  return `${source}_${base}_${h}`;
}

function mergeTags(existing: string[] | null, incoming: string[]): string[] {
  const set = new Set<string>();
  for (const tag of existing || []) {
    const trimmed = (tag || "").trim();
    if (trimmed) set.add(trimmed);
  }
  for (const tag of incoming) {
    const trimmed = (tag || "").trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

function parseTags(value: IngestEnvelope["lead"]["tags"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v.length > 0);
  }

  return value
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.length <= 2000) return message;
  return `${message.slice(0, 1997)}...`;
}

function retryDelayMs(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  if (attemptCount === 1) return 1000;
  if (attemptCount === 2) return 4000;
  return 16000;
}

function shouldRetryNow(row: IngestionEventRow): boolean {
  if (row.status === "received") return true;
  if (row.status !== "failed") return false;

  const updatedAtMs = Date.parse(row.updated_at || row.created_at);
  if (Number.isNaN(updatedAtMs)) return true;
  const waitMs = retryDelayMs(row.attempt_count);
  return Date.now() - updatedAtMs >= waitMs;
}

async function findLeadByKeys(input: {
  admin: AdminClient;
  agentId: string;
  source: string;
  sourceRefId: string | null;
  canonicalEmail: string | null;
  canonicalPhone: string | null;
  igUsername: string | null;
}): Promise<LeadRow | null> {
  const columns = "id,agent_id,ig_username,canonical_email,canonical_phone,first_name,last_name,full_name,source,source_ref_id,stage,lead_temp,consent_to_email,consent_to_sms,consent_source,consent_timestamp,consent_text_snapshot,tags,custom_fields";

  if (input.sourceRefId) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("source", input.source)
      .eq("source_ref_id", input.sourceRefId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!error && data) return data as LeadRow;
  }

  if (input.canonicalEmail) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("canonical_email", input.canonicalEmail)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as LeadRow;
  }

  if (input.canonicalPhone) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("canonical_phone", input.canonicalPhone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as LeadRow;
  }

  if (input.igUsername) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("ig_username", input.igUsername)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as LeadRow;
  }

  return null;
}

async function markIngestionFailure(
  admin: AdminClient,
  row: IngestionEventRow,
  failure: unknown
): Promise<"failed" | "dlq"> {
  const nextAttempt = Number(row.attempt_count || 0) + 1;
  const status = nextAttempt >= 3 ? "dlq" : "failed";

  const { error } = await admin
    .from("ingestion_events")
    .update({
      status,
      attempt_count: nextAttempt,
      error_message: truncateError(failure),
      processed_at: status === "dlq" ? new Date().toISOString() : null,
    })
    .eq("id", row.id)
    .eq("agent_id", row.agent_id);

  if (error) {
    console.error("[ingest] failed to update ingestion failure state", {
      eventId: row.id,
      error: error.message,
    });
  }

  return status;
}

async function insertLeadEvents(input: {
  admin: AdminClient;
  leadId: string;
  agentId: string;
  source: string;
  eventType: string;
  externalEventId: string;
  ingestionEventId: string;
  created: boolean;
  occurredAt: string;
}) {
  const rows = [] as Array<Record<string, unknown>>;

  if (input.created) {
    rows.push({
      lead_id: input.leadId,
      agent_id: input.agentId,
      event_type: "created",
      event_data: {
        source: input.source,
        external_event_id: input.externalEventId,
        ingestion_event_id: input.ingestionEventId,
      },
      actor_id: null,
      created_at: input.occurredAt,
    });
  }

  rows.push({
    lead_id: input.leadId,
    agent_id: input.agentId,
    event_type: input.eventType,
    event_data: {
      source: input.source,
      external_event_id: input.externalEventId,
      ingestion_event_id: input.ingestionEventId,
    },
    actor_id: null,
    created_at: input.occurredAt,
  });

  const { error } = await input.admin.from("lead_events").insert(rows);
  if (error) {
    throw new Error(`lead_events insert failed: ${error.message}`);
  }
}

export async function enqueueIngestionEvent(input: EnqueueInput): Promise<EnqueueResult> {
  const { data, error } = await input.admin
    .from("ingestion_events")
    .insert({
      agent_id: input.agentId,
      source: input.source,
      external_event_id: input.externalEventId,
      payload_hash: input.payloadHash,
      status: "received",
      raw_payload: input.rawPayload,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    return { inserted: true, eventId: data.id };
  }

  if (error?.code !== "23505") {
    throw new Error(error?.message || "Could not insert ingestion event.");
  }

  const { data: existing, error: existingError } = await input.admin
    .from("ingestion_events")
    .select("id,status")
    .eq("agent_id", input.agentId)
    .eq("source", input.source)
    .eq("external_event_id", input.externalEventId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    throw new Error(existingError?.message || "Could not fetch duplicate ingestion event.");
  }

  return { inserted: false, eventId: existing.id, status: existing.status || "received" };
}

export async function processIngestionEventById(
  admin: AdminClient,
  eventId: string
): Promise<{ status: "processed" | "failed" | "dlq" | "skipped"; leadId?: string }> {
  const { data, error } = await admin
    .from("ingestion_events")
    .select("id,agent_id,source,external_event_id,status,attempt_count,raw_payload,updated_at,created_at")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || `Ingestion event ${eventId} not found.`);
  }

  const row = data as IngestionEventRow;
  if (row.status === "processed" || row.status === "dlq") {
    return { status: "skipped" };
  }

  try {
    const parsed = ingestEnvelopeSchema.safeParse(row.raw_payload);
    if (!parsed.success) {
      const status = await markIngestionFailure(admin, row, parsed.error);
      return { status };
    }

    const payload = parsed.data;
    const lead = payload.lead;

    const firstName = safeTrim(lead.first_name);
    const lastName = safeTrim(lead.last_name);
    const fullName =
      safeTrim(lead.full_name) ||
      [firstName, lastName].filter((v): v is string => Boolean(v)).join(" ") ||
      null;

    const rawEmail = safeTrim(lead.email);
    const rawPhone = safeTrim(lead.phone);
    const canonicalEmail = normalizeEmail(rawEmail);
    const canonicalPhone = normalizePhoneToE164(rawPhone);
    const sourceRefId = safeTrim(lead.source_ref_id) || safeTrim(payload.source_ref_id);
    const igUsername =
      normalizeHandle(safeTrim(lead.ig_username)) ||
      syntheticHandle(row.source, canonicalEmail || canonicalPhone || fullName || row.external_event_id);

    const incomingTags = parseTags(lead.tags);
    const incomingCustomFields = (lead.custom_fields || {}) as Record<string, unknown>;
    const nowIso = new Date().toISOString();

    const incomingConsent = normalizeConsent({
      source: safeTrim(lead.source) || row.source,
      consent_to_email: lead.consent_to_email,
      consent_to_sms: lead.consent_to_sms,
      consent_source: safeTrim(lead.consent_source) || row.source,
      consent_timestamp: safeTrim(lead.consent_timestamp),
      consent_text_snapshot: safeTrim(lead.consent_text_snapshot),
      nowIso,
    });

    const existingLead = await findLeadByKeys({
      admin,
      agentId: row.agent_id,
      source: row.source,
      sourceRefId,
      canonicalEmail,
      canonicalPhone,
      igUsername,
    });

    let leadId = existingLead?.id || null;
    let created = false;

    if (existingLead) {
      const mergedConsent = normalizeConsent({
        source: existingLead.source || incomingConsent.consent_source || row.source,
        consent_to_email: Boolean(existingLead.consent_to_email || incomingConsent.consent_to_email),
        consent_to_sms: Boolean(existingLead.consent_to_sms || incomingConsent.consent_to_sms),
        consent_source: incomingConsent.consent_source || existingLead.consent_source || row.source,
        consent_timestamp: existingLead.consent_timestamp || incomingConsent.consent_timestamp,
        consent_text_snapshot:
          incomingConsent.consent_text_snapshot || existingLead.consent_text_snapshot,
        nowIso,
      });
      const mergedTags = mergeTags(existingLead.tags, incomingTags);
      const patch: Record<string, unknown> = {
        first_name: existingLead.first_name || firstName,
        last_name: existingLead.last_name || lastName,
        full_name: existingLead.full_name || fullName,
        raw_email: existingLead.canonical_email ? existingLead.canonical_email : rawEmail,
        raw_phone: existingLead.canonical_phone ? existingLead.canonical_phone : rawPhone,
        canonical_email: existingLead.canonical_email || canonicalEmail,
        canonical_phone: existingLead.canonical_phone || canonicalPhone,
        source: existingLead.source || safeTrim(lead.source) || row.source,
        source_ref_id: existingLead.source_ref_id || sourceRefId,
        tags: mergedTags,
        custom_fields: {
          ...(existingLead.custom_fields || {}),
          ...incomingCustomFields,
        },
        consent_to_email: mergedConsent.consent_to_email,
        consent_to_sms: mergedConsent.consent_to_sms,
        consent_source: mergedConsent.consent_source,
        consent_timestamp: mergedConsent.consent_timestamp,
        consent_text_snapshot: mergedConsent.consent_text_snapshot,
        time_last_updated: nowIso,
      };

      const { error: updateError } = await admin
        .from("leads")
        .update(patch)
        .eq("id", existingLead.id)
        .eq("agent_id", row.agent_id);

      if (updateError) {
        const status = await markIngestionFailure(admin, row, updateError);
        return { status };
      }
    } else {
      const stage = safeTrim(lead.stage) || "New";
      const source = safeTrim(lead.source) || row.source;
      const sourceConfidence = canonicalEmail || canonicalPhone ? "exact" : "inferred";

      const insertPayload: Record<string, unknown> = {
        agent_id: row.agent_id,
        owner_user_id: row.agent_id,
        assignee_user_id: row.agent_id,
        ig_username: igUsername,
        stage,
        lead_temp: "Warm",
        source,
        source_ref_id: sourceRefId,
        source_confidence: sourceConfidence,
        source_detail: {
          ingestion_source: row.source,
          external_event_id: row.external_event_id,
        },
        first_source_method: "webhook",
        latest_source_method: "webhook",
        raw_email: rawEmail,
        raw_phone: rawPhone,
        canonical_email: canonicalEmail,
        canonical_phone: canonicalPhone,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        tags: incomingTags,
        custom_fields: incomingCustomFields,
        consent_to_email: incomingConsent.consent_to_email,
        consent_to_sms: incomingConsent.consent_to_sms,
        consent_source: incomingConsent.consent_source,
        consent_timestamp: incomingConsent.consent_timestamp,
        consent_text_snapshot: incomingConsent.consent_text_snapshot,
        time_last_updated: nowIso,
      };

      const { data: inserted, error: insertError } = await admin
        .from("leads")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        const status = await markIngestionFailure(admin, row, insertError || "Lead insert failed.");
        return { status };
      }

      leadId = inserted.id;
      created = true;
    }

    if (!leadId) {
      const status = await markIngestionFailure(admin, row, "Lead resolution returned empty id.");
      return { status };
    }

    const eventType = safeTrim(payload.event_type) || "ingested";
    const occurredAt = safeTrim(payload.occurred_at) || nowIso;
    await insertLeadEvents({
      admin,
      leadId,
      agentId: row.agent_id,
      source: row.source,
      eventType,
      externalEventId: row.external_event_id,
      ingestionEventId: row.id,
      created,
      occurredAt,
    });

    const { error: finalizeError } = await admin
      .from("ingestion_events")
      .update({
        status: "processed",
        attempt_count: Number(row.attempt_count || 0) + 1,
        error_message: null,
        lead_id_created: leadId,
        processed_at: nowIso,
      })
      .eq("id", row.id)
      .eq("agent_id", row.agent_id);

    if (finalizeError) {
      throw new Error(finalizeError.message);
    }

    return { status: "processed", leadId };
  } catch (error) {
    const status = await markIngestionFailure(admin, row, error);
    return { status };
  }
}

export async function processPendingIngestionEvents(
  admin: AdminClient,
  limit = 25
): Promise<ProcessResult> {
  const safeLimit = Math.max(1, Math.min(200, Math.round(limit)));

  const { data, error } = await admin
    .from("ingestion_events")
    .select("id,agent_id,source,external_event_id,status,attempt_count,raw_payload,updated_at,created_at")
    .in("status", ["received", "failed"])
    .lt("attempt_count", 3)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as IngestionEventRow[];
  const out: ProcessResult = { processed: 0, failed: 0, dlq: 0 };

  for (const row of rows) {
    if (!shouldRetryNow(row)) continue;
    const result = await processIngestionEventById(admin, row.id);
    if (result.status === "processed") out.processed += 1;
    if (result.status === "failed") out.failed += 1;
    if (result.status === "dlq") out.dlq += 1;
  }

  return out;
}

export function deriveExternalEventId(rawBody: string, explicit: string | null): string {
  if (explicit) return explicit;
  return hashPayload(rawBody).slice(0, 48);
}

export function derivePayloadHash(rawBody: string): string {
  return hashPayload(rawBody);
}
