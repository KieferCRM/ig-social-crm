import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

export type LeadIdentityRow = {
  id: string;
  agent_id: string;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  stage: string | null;
  lead_temp: string | null;
  source_confidence: string | null;
  first_source_method: string | null;
  latest_source_method: string | null;
  first_source_channel: string | null;
  latest_source_channel: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  raw_email: string | null;
  raw_phone: string | null;
  source: string | null;
  source_ref_id: string | null;
  consent_to_email: boolean | null;
  consent_to_sms: boolean | null;
  consent_source: string | null;
  consent_timestamp: string | null;
  consent_text_snapshot: string | null;
  custom_fields: Record<string, unknown> | null;
  source_detail: Record<string, unknown> | null;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLeadHandle(value: string | null | undefined): string | null {
  const raw = optionalString(value);
  if (!raw) return null;
  return raw.replace(/^@+/, "").toLowerCase();
}

export function normalizeLeadEmail(value: string | null | undefined): string | null {
  const raw = optionalString(value);
  if (!raw) return null;
  return raw.toLowerCase();
}

export function normalizeLeadPhone(value: string | null | undefined): string | null {
  const raw = optionalString(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) {
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

export function leadPhoneCandidates(value: string | null | undefined): string[] {
  const raw = optionalString(value);
  if (!raw) return [];

  const normalized = normalizeLeadPhone(raw);
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = raw.replace(/\D/g, "");
  const plusDigits = digits ? `+${digits}` : null;

  const candidates = [normalized, cleaned || null, digits || null, plusDigits]
    .map((item) => optionalString(item))
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(candidates));
}

export function buildSyntheticLeadHandle(prefix: string, identity: string): string {
  const normalizedPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "lead";

  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 8);
  return `${normalizedPrefix}_${digest}`;
}

export async function findExistingLeadByIdentity(input: {
  admin: AdminClient;
  agentId: string;
  source?: string | null;
  sourceRefId?: string | null;
  canonicalEmail?: string | null;
  phoneInput?: string | null;
  igUsername?: string | null;
}): Promise<LeadIdentityRow | null> {
  const columns =
    "id,agent_id,owner_user_id,assignee_user_id,ig_username,full_name,first_name,last_name,stage,lead_temp,source_confidence,first_source_method,latest_source_method,first_source_channel,latest_source_channel,canonical_email,canonical_phone,raw_email,raw_phone,source,source_ref_id,consent_to_email,consent_to_sms,consent_source,consent_timestamp,consent_text_snapshot,custom_fields,source_detail";

  const source = optionalString(input.source || null);
  const sourceRefId = optionalString(input.sourceRefId || null);
  if (source && sourceRefId) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("source", source)
      .eq("source_ref_id", sourceRefId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!error && data) {
      return data as LeadIdentityRow;
    }
  }

  for (const phone of leadPhoneCandidates(input.phoneInput || null)) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("canonical_phone", phone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as LeadIdentityRow;
    }
  }

  const canonicalEmail = normalizeLeadEmail(input.canonicalEmail || null);
  if (canonicalEmail) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("canonical_email", canonicalEmail)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as LeadIdentityRow;
    }
  }

  const igUsername = normalizeLeadHandle(input.igUsername || null);
  if (igUsername) {
    const { data, error } = await input.admin
      .from("leads")
      .select(columns)
      .eq("agent_id", input.agentId)
      .eq("ig_username", igUsername)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as LeadIdentityRow;
    }
  }

  return null;
}
