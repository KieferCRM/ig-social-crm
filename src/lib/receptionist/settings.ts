export const RECEPTIONIST_SETTINGS_KEY = "receptionist_settings";

export type ReceptionistPhoneSetupPath = "lockbox_number" | "existing_number";
export type ReceptionistPhoneSetupStatus =
  | "unassigned"
  | "assigned"
  | "existing_submitted"
  | "existing_manual_review"
  | "existing_ready"
  | "porting_requested"
  | "ported";

export type ReceptionistSettings = {
  receptionist_enabled: boolean;
  communications_enabled: boolean;
  missed_call_textback_enabled: boolean;
  after_hours_enabled: boolean;
  office_hours_start: string;
  office_hours_end: string;
  office_hours_timezone: string;
  business_phone_number: string;
  forwarding_phone_number: string;
  custom_greeting: string;
  notification_phone_number: string;
  escalation_keywords: string[];
  phone_setup_path: ReceptionistPhoneSetupPath;
  phone_setup_status: ReceptionistPhoneSetupStatus;
  business_number_provider: string;
  existing_number_submitted_at: string;
  existing_number_setup_notes: string;
};

const DEFAULT_ESCALATION_KEYWORDS = [
  "today",
  "asap",
  "this week",
  "ready now",
  "call me",
  "tour",
  "offer",
];

export const DEFAULT_RECEPTIONIST_SETTINGS: ReceptionistSettings = {
  receptionist_enabled: true,
  communications_enabled: true,
  missed_call_textback_enabled: true,
  after_hours_enabled: false,
  office_hours_start: "09:00",
  office_hours_end: "18:00",
  office_hours_timezone: "America/Chicago",
  business_phone_number: "",
  forwarding_phone_number: "",
  custom_greeting: "",
  notification_phone_number: "",
  escalation_keywords: DEFAULT_ESCALATION_KEYWORDS,
  phone_setup_path: "lockbox_number",
  phone_setup_status: "unassigned",
  business_number_provider: "",
  existing_number_submitted_at: "",
  existing_number_setup_notes: "",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeHourMinute(value: string, fallback: string): string {
  if (!/^\d{1,2}:\d{2}$/.test(value)) return fallback;
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeKeywordList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;]+/)
      : [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const keyword = item.trim().toLowerCase();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    normalized.push(keyword);
  }

  return normalized.length > 0 ? normalized : [...DEFAULT_ESCALATION_KEYWORDS];
}

function normalizePhoneSetupPath(
  value: unknown,
  fallback: ReceptionistPhoneSetupPath
): ReceptionistPhoneSetupPath {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "lockbox_number" || normalized === "existing_number") {
    return normalized;
  }
  if (normalized.endsWith("_number") && normalized !== "existing_number") {
    return "lockbox_number";
  }
  return fallback;
}

function normalizePhoneSetupStatus(
  value: unknown,
  fallback: ReceptionistPhoneSetupStatus
): ReceptionistPhoneSetupStatus {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "unassigned" ||
    normalized === "assigned" ||
    normalized === "existing_submitted" ||
    normalized === "existing_manual_review" ||
    normalized === "existing_ready" ||
    normalized === "porting_requested" ||
    normalized === "ported"
  ) {
    return normalized;
  }
  return fallback;
}

export function normalizeReceptionistSettings(input: unknown): ReceptionistSettings {
  const raw = asRecord(input) || {};
  const businessPhoneNumber = readString(raw.business_phone_number);
  const hasBusinessPhone = businessPhoneNumber.length > 0;
  const inferredPath: ReceptionistPhoneSetupPath =
    businessPhoneNumber.length > 0 && readString(raw.business_number_provider).length > 0
      ? "lockbox_number"
      : hasBusinessPhone
        ? "existing_number"
        : DEFAULT_RECEPTIONIST_SETTINGS.phone_setup_path;
  const phoneSetupPath = normalizePhoneSetupPath(raw.phone_setup_path, inferredPath);
  const inferredStatus: ReceptionistPhoneSetupStatus = hasBusinessPhone
    ? phoneSetupPath === "lockbox_number"
      ? "assigned"
      : "existing_ready"
    : DEFAULT_RECEPTIONIST_SETTINGS.phone_setup_status;
  const phoneSetupStatus = normalizePhoneSetupStatus(raw.phone_setup_status, inferredStatus);

  return {
    receptionist_enabled: readBoolean(
      raw.receptionist_enabled,
      DEFAULT_RECEPTIONIST_SETTINGS.receptionist_enabled
    ),
    communications_enabled: readBoolean(
      raw.communications_enabled,
      DEFAULT_RECEPTIONIST_SETTINGS.communications_enabled
    ),
    missed_call_textback_enabled: readBoolean(
      raw.missed_call_textback_enabled,
      DEFAULT_RECEPTIONIST_SETTINGS.missed_call_textback_enabled
    ),
    after_hours_enabled: readBoolean(
      raw.after_hours_enabled,
      DEFAULT_RECEPTIONIST_SETTINGS.after_hours_enabled
    ),
    office_hours_start: normalizeHourMinute(
      readString(raw.office_hours_start, DEFAULT_RECEPTIONIST_SETTINGS.office_hours_start),
      DEFAULT_RECEPTIONIST_SETTINGS.office_hours_start
    ),
    office_hours_end: normalizeHourMinute(
      readString(raw.office_hours_end, DEFAULT_RECEPTIONIST_SETTINGS.office_hours_end),
      DEFAULT_RECEPTIONIST_SETTINGS.office_hours_end
    ),
    office_hours_timezone:
      readString(raw.office_hours_timezone, DEFAULT_RECEPTIONIST_SETTINGS.office_hours_timezone) ||
      DEFAULT_RECEPTIONIST_SETTINGS.office_hours_timezone,
    business_phone_number: businessPhoneNumber,
    forwarding_phone_number: readString(raw.forwarding_phone_number),
    custom_greeting: readString(raw.custom_greeting),
    notification_phone_number: readString(raw.notification_phone_number),
    escalation_keywords: normalizeKeywordList(raw.escalation_keywords),
    phone_setup_path: phoneSetupPath,
    phone_setup_status: phoneSetupStatus,
    business_number_provider: readString(raw.business_number_provider),
    existing_number_submitted_at: readString(raw.existing_number_submitted_at),
    existing_number_setup_notes: readString(raw.existing_number_setup_notes),
  };
}

export function readReceptionistSettingsFromAgentSettings(settings: unknown): ReceptionistSettings {
  const record = asRecord(settings);
  if (!record) return { ...DEFAULT_RECEPTIONIST_SETTINGS };
  return normalizeReceptionistSettings(record[RECEPTIONIST_SETTINGS_KEY]);
}

export function mergeReceptionistIntoAgentSettings(
  settings: unknown,
  patch: unknown
): Record<string, unknown> {
  const base = asRecord(settings) ? { ...(settings as Record<string, unknown>) } : {};
  const current = normalizeReceptionistSettings(base[RECEPTIONIST_SETTINGS_KEY]);
  const nextPatch = asRecord(patch) || {};

  base[RECEPTIONIST_SETTINGS_KEY] = normalizeReceptionistSettings({
    ...current,
    ...nextPatch,
  });

  return base;
}

function minutesFromHHMM(value: string): number {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour * 60 + minute;
}

function currentMinutesInTimezone(date: Date, timezone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value || "NaN");
    const minute = Number(parts.find((part) => part.type === "minute")?.value || "NaN");
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

export function isWithinOfficeHours(
  settings: ReceptionistSettings,
  now = new Date()
): boolean {
  const currentMinutes = currentMinutesInTimezone(now, settings.office_hours_timezone);
  if (currentMinutes === null) return true;

  const start = minutesFromHHMM(settings.office_hours_start);
  const end = minutesFromHHMM(settings.office_hours_end);

  if (start === end) return true;
  if (start < end) {
    return currentMinutes >= start && currentMinutes <= end;
  }

  return currentMinutes >= start || currentMinutes <= end;
}

export function shouldSendMissedCallTextback(
  settings: ReceptionistSettings,
  now = new Date()
): boolean {
  if (!settings.receptionist_enabled) return false;
  if (!settings.communications_enabled) return false;
  if (!settings.missed_call_textback_enabled) return false;
  if (!settings.after_hours_enabled) return true;
  return !isWithinOfficeHours(settings, now);
}

export function buildMissedCallStarterText(
  agentName: string,
  settings: ReceptionistSettings
): string {
  const custom = settings.custom_greeting.trim();
  if (custom) return custom;
  const displayName = agentName.trim() || "your agent";
  return `Hi, this is the assistant for ${displayName}. Sorry we missed your call - are you looking to buy, sell, buy and sell, rent, or invest?`;
}
