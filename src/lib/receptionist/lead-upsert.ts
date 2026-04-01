import { createHash } from "crypto";
import { normalizeTimeframeBucket } from "@/lib/inbound";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

export type ReceptionistLeadRow = {
  id: string;
  agent_id: string;
  ig_username: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  raw_email: string | null;
  raw_phone: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  budget_range: string | null;
  location_area: string | null;
  contact_preference: string | null;
  notes: string | null;
  next_step: string | null;
  urgency_level: string | null;
  urgency_score: number | null;
  source_detail: Record<string, unknown> | null;
};

export type ReceptionistLeadInput = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  location_area?: string | null;
  contact_preference?: string | null;
  notes?: string | null;
  next_step?: string | null;
  source?: string | null;
  source_detail?: Record<string, unknown> | null;
  urgency_level?: "normal" | "high" | null;
  urgency_score?: number | null;
  interaction_at?: string | null;
};

export type UpsertReceptionistLeadResult = {
  lead: ReceptionistLeadRow;
  created: boolean;
  matchedBy: "phone" | "email" | "new";
  previousUrgencyScore: number;
};

export type QualificationQuestion = {
  field:
    | "full_name"
    | "email"
    | "intent"
    | "timeline"
    | "budget_range"
    | "location_area"
    | "contact_preference";
  prompt: string;
};

const QUALIFICATION_SEQUENCE: QualificationQuestion[] = [
  { field: "full_name", prompt: "What is your full name?" },
  { field: "email", prompt: "What is the best email for updates?" },
  {
    field: "intent",
    prompt: "Are you looking to buy, sell, buy and sell, rent, or invest?",
  },
  { field: "timeline", prompt: "What's your timeframe?" },
  { field: "budget_range", prompt: "What budget range should we work with?" },
  { field: "location_area", prompt: "Which area or neighborhood are you focused on?" },
  {
    field: "contact_preference",
    prompt: "Do you prefer text, call, or email for follow-up?",
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string | null): string | null {
  return value ? value.trim().toLowerCase() : null;
}

export function normalizePhoneToE164(value: string | null): string | null {
  if (!value) return null;
  const input = value.trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (input.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function syntheticHandle(identity: string): string {
  const base = identity
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return `receptionist_${base || "lead"}_${shortHash(identity)}`;
}

function mergeNotes(existing: string | null, incoming: string | null): string | null {
  const next = optionalString(incoming);
  if (!next) return existing;
  const current = optionalString(existing);
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current}\n\n${next}`;
}

function mergeSource(
  existing: string | null,
  incoming: string | null
): string | null {
  const next = optionalString(incoming);
  if (!next) return existing;

  const current = optionalString(existing);
  if (!current) return next;

  const low = current.toLowerCase();
  if (low === "manual" || low === "direct entry" || low === "unknown") return next;
  return current;
}

function betterUrgencyLevel(
  existing: string | null,
  incoming: "normal" | "high" | null
): "normal" | "high" | null {
  if (incoming === "high") return "high";
  if (existing === "high") return "high";
  if (incoming === "normal") return "normal";
  if (existing === "normal") return "normal";
  return null;
}

function normalizeUrgencyScore(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(Number(value));
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

/**
 * Maps the Secretary urgency score (0–100) to the off-market lead temperature.
 * 70–100 → Hot  |  40–69 → Warm  |  1–39 → Cold  |  0 / null → Unclassified
 */
export function urgencyScoreToLeadTemp(
  score: number | null
): "Hot" | "Warm" | "Cold" | "Unclassified" {
  if (score === null || score === 0) return "Unclassified";
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}

const LEAD_TEMP_RANK: Record<string, number> = {
  Hot: 3,
  Warm: 2,
  Cold: 1,
  Unclassified: 0,
};

function betterLeadTemp(existing: string | null, incoming: string): string {
  const existingRank = LEAD_TEMP_RANK[existing || ""] ?? 0;
  const incomingRank = LEAD_TEMP_RANK[incoming] ?? 0;
  return incomingRank > existingRank ? incoming : existing || incoming;
}

async function findLeadByIdentity(input: {
  admin: AdminClient;
  agentId: string;
  canonicalPhone: string | null;
  canonicalEmail: string | null;
}): Promise<{ lead: ReceptionistLeadRow | null; matchedBy: "phone" | "email" | "new" }> {
  const columns =
    "id,agent_id,ig_username,canonical_email,canonical_phone,raw_email,raw_phone,full_name,first_name,last_name,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,notes,next_step,urgency_level,urgency_score,source_detail";

  if (input.canonicalPhone) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("canonical_phone", input.canonicalPhone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return { lead: data as ReceptionistLeadRow, matchedBy: "phone" };
    }
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

    if (!error && data) {
      return { lead: data as ReceptionistLeadRow, matchedBy: "email" };
    }
  }

  return { lead: null, matchedBy: "new" };
}

function chooseMissing(existing: string | null, incoming: string | null): string | null {
  return optionalString(existing) || optionalString(incoming);
}

export function nextMissingReceptionistQuestion(
  lead: Partial<ReceptionistLeadRow>
): QualificationQuestion | null {
  for (const question of QUALIFICATION_SEQUENCE) {
    const value =
      question.field === "email"
        ? lead.canonical_email
        : lead[question.field as keyof ReceptionistLeadRow];
    if (!optionalString(typeof value === "string" ? value : null)) {
      return question;
    }
  }
  return null;
}

export function extractNameFromText(text: string): string | null {
  const patterns = [
    /my name(?:'s| is) ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/i,
    /this is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/i,
    /i(?:'m| am) ([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/i,
    /name(?:'s| is) ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/i,
  ];
  const stopWords = new Set([
    "calling", "interested", "looking", "trying", "wondering",
    "contacting", "available", "a", "the", "not", "just",
  ]);
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (!stopWords.has(name.toLowerCase())) return name;
    }
  }
  return null;
}

export function extractStructuredFieldsFromSms(text: string): ReceptionistLeadInput {
  const raw = text.trim();
  if (!raw) return {};
  const lower = raw.toLowerCase();
  const output: ReceptionistLeadInput = {};

  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  if (email) output.email = email;

  const name = extractNameFromText(raw);
  if (name) output.full_name = name;

  if (/\b(buy and sell|buy\/sell|both)\b/i.test(lower)) {
    output.intent = "Buy and sell";
  } else if (/\bbuy\b/i.test(lower)) {
    output.intent = "Buy";
  } else if (/\bsell\b/i.test(lower)) {
    output.intent = "Sell";
  } else if (/\binvest|investor\b/i.test(lower)) {
    output.intent = "Invest";
  } else if (/\brent|rental\b/i.test(lower)) {
    output.intent = "Rent";
  }

  const timeframe = normalizeTimeframeBucket(raw);
  if (timeframe) {
    output.timeline = timeframe;
  }

  const budgetCandidates = raw.match(/\$?\d[\d,]*(?:\.\d+)?\s*[kKmM]?/g) || [];
  if (budgetCandidates.length >= 2) {
    output.budget_range = `${budgetCandidates[0]} - ${budgetCandidates[1]}`;
  } else if (budgetCandidates.length === 1 && /\b(budget|price|max|min|range|under|over)\b/i.test(lower)) {
    output.budget_range = budgetCandidates[0] || null;
  }

  const locationMatch = raw.match(/\b(?:in|near|around|at)\s+([A-Za-z][A-Za-z\s\-]{2,50})/i);
  if (locationMatch?.[1]) {
    output.location_area = locationMatch[1].trim().replace(/[.,!?;:]+$/, "");
  }

  if (/\b(text|sms)\b/i.test(lower)) {
    output.contact_preference = "Text";
  } else if (/\bcall\b/i.test(lower)) {
    output.contact_preference = "Call";
  } else if (/\bemail\b/i.test(lower)) {
    output.contact_preference = "Email";
  }

  if (/\b(call me|tour|showing|offer|appointment)\b/i.test(lower)) {
    output.next_step = "Agent callback requested";
  }

  return output;
}

export async function upsertReceptionistLead(input: {
  admin: AdminClient;
  agentId: string;
  source: string;
  values: ReceptionistLeadInput;
}): Promise<UpsertReceptionistLeadResult> {
  const canonicalEmail = normalizeEmail(optionalString(input.values.email));
  const canonicalPhone = normalizePhoneToE164(optionalString(input.values.phone));
  const fullName = optionalString(input.values.full_name);
  const firstName = optionalString(input.values.first_name);
  const lastName = optionalString(input.values.last_name);
  const source = optionalString(input.values.source) || input.source;
  const nowIso = input.values.interaction_at || new Date().toISOString();

  const existingLookup = await findLeadByIdentity({
    admin: input.admin,
    agentId: input.agentId,
    canonicalPhone,
    canonicalEmail,
  });

  const sourceDetailPatch = asRecord(input.values.source_detail) || {};
  sourceDetailPatch.last_receptionist_source = source;

  if (existingLookup.lead) {
    const existing = existingLookup.lead;
    const incomingScore = normalizeUrgencyScore(input.values.urgency_score) || 0;
    const existingScore = normalizeUrgencyScore(existing.urgency_score) || 0;
    const newUrgencyScore = Math.max(existingScore, incomingScore);
    const incomingTemp = urgencyScoreToLeadTemp(incomingScore);

    const patch: Record<string, unknown> = {
      full_name: chooseMissing(existing.full_name, fullName),
      first_name: chooseMissing(existing.first_name, firstName),
      last_name: chooseMissing(existing.last_name, lastName),
      canonical_email: chooseMissing(existing.canonical_email, canonicalEmail),
      raw_email: chooseMissing(existing.raw_email, canonicalEmail),
      canonical_phone: chooseMissing(existing.canonical_phone, canonicalPhone),
      raw_phone: chooseMissing(existing.raw_phone, canonicalPhone),
      source: mergeSource(existing.source, source),
      intent: chooseMissing(existing.intent, optionalString(input.values.intent)),
      timeline: chooseMissing(existing.timeline, optionalString(input.values.timeline)),
      budget_range: chooseMissing(existing.budget_range, optionalString(input.values.budget_range)),
      location_area: chooseMissing(existing.location_area, optionalString(input.values.location_area)),
      contact_preference: chooseMissing(
        existing.contact_preference,
        optionalString(input.values.contact_preference)
      ),
      next_step: chooseMissing(existing.next_step, optionalString(input.values.next_step)),
      notes: mergeNotes(existing.notes, optionalString(input.values.notes)),
      urgency_level: betterUrgencyLevel(existing.urgency_level, input.values.urgency_level || null),
      urgency_score: newUrgencyScore,
      // Only upgrade lead_temp — never downgrade it
      lead_temp: betterLeadTemp(existing.lead_temp, incomingTemp),
      source_detail: {
        ...(asRecord(existing.source_detail) || {}),
        ...sourceDetailPatch,
      },
      time_last_updated: nowIso,
      last_communication_at: nowIso,
    };

    const { data, error } = await input.admin
      .from("leads")
      .update(patch)
      .eq("id", existing.id)
      .eq("agent_id", input.agentId)
      .select(
        "id,agent_id,ig_username,canonical_email,canonical_phone,raw_email,raw_phone,full_name,first_name,last_name,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,notes,next_step,urgency_level,urgency_score,source_detail"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Could not update receptionist lead.");
    }

    return {
      lead: data as ReceptionistLeadRow,
      created: false,
      matchedBy: existingLookup.matchedBy,
      previousUrgencyScore: normalizeUrgencyScore(existing.urgency_score) || 0,
    };
  }

  const identity =
    canonicalPhone || canonicalEmail || fullName || `${input.agentId}_${Date.now().toString(36)}`;

  const insertPayload: Record<string, unknown> = {
    agent_id: input.agentId,
    owner_user_id: input.agentId,
    assignee_user_id: input.agentId,
    ig_username: syntheticHandle(identity),
    stage: "New",
    lead_temp: urgencyScoreToLeadTemp(normalizeUrgencyScore(input.values.urgency_score)),
    source,
    full_name: fullName || null,
    first_name: firstName || null,
    last_name: lastName || null,
    canonical_email: canonicalEmail,
    raw_email: canonicalEmail,
    canonical_phone: canonicalPhone,
    raw_phone: canonicalPhone,
    intent: optionalString(input.values.intent),
    timeline: optionalString(input.values.timeline),
    budget_range: optionalString(input.values.budget_range),
    location_area: optionalString(input.values.location_area),
    contact_preference: optionalString(input.values.contact_preference),
    notes: optionalString(input.values.notes),
    next_step: optionalString(input.values.next_step),
    urgency_level: input.values.urgency_level || null,
    urgency_score: normalizeUrgencyScore(input.values.urgency_score),
    source_detail: sourceDetailPatch,
    custom_fields: {},
    first_source_method: "webhook",
    latest_source_method: "webhook",
    first_source_channel: "phone",
    latest_source_channel: "phone",
    time_last_updated: nowIso,
    last_communication_at: nowIso,
  };

  const { data, error } = await input.admin
    .from("leads")
    .insert(insertPayload)
    .select(
      "id,agent_id,ig_username,canonical_email,canonical_phone,raw_email,raw_phone,full_name,first_name,last_name,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,notes,next_step,urgency_level,urgency_score,source_detail"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create receptionist lead.");
  }

  return {
    lead: data as ReceptionistLeadRow,
    created: true,
    matchedBy: "new",
    previousUrgencyScore: 0,
  };
}
