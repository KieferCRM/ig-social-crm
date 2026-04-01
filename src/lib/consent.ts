type ConsentInput = {
  source: string | null | undefined;
  consent_to_email?: unknown;
  consent_to_sms?: unknown;
  consent_source?: string | null | undefined;
  consent_timestamp?: string | null | undefined;
  consent_text_snapshot?: string | null | undefined;
  nowIso?: string;
};

type ConsentRecord = {
  consent_to_email: boolean;
  consent_to_sms: boolean;
  consent_source: string;
  consent_timestamp: string;
  consent_text_snapshot: string;
};

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeTimestamp(value: string | null | undefined, fallbackIso: string): string {
  const text = asOptionalString(value);
  if (!text) return fallbackIso;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
}

export function normalizeConsent(input: ConsentInput): ConsentRecord {
  const nowIso = input.nowIso || new Date().toISOString();
  const consentToEmail = toBoolean(input.consent_to_email, false);
  const consentToSms = toBoolean(input.consent_to_sms, false);
  const source =
    asOptionalString(input.consent_source) ||
    asOptionalString(input.source) ||
    "unknown_ingestion_source";

  const explicitSnapshot = asOptionalString(input.consent_text_snapshot);
  const consentTextSnapshot =
    explicitSnapshot ||
    (consentToEmail || consentToSms
      ? `Consent captured from ${source}.`
      : `Consent not explicitly captured from ${source}.`);

  return {
    consent_to_email: consentToEmail,
    consent_to_sms: consentToSms,
    consent_source: source,
    consent_timestamp: normalizeTimestamp(input.consent_timestamp, nowIso),
    consent_text_snapshot: consentTextSnapshot,
  };
}
