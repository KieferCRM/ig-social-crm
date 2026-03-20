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

// Voice tier: "none" = core CRM only, "sms" = Secretary SMS, "voice" = Secretary Voice
export type VoiceTier = "none" | "sms" | "voice";
// How the AI handles inbound calls
export type CallHandlingMode =
  | "qualify_transfer"   // AI qualifies, then transfers to agent if available
  | "always_transfer"    // AI greets then immediately bridges to agent; AI takes message if unavailable
  | "always_ai"          // AI always handles call, qualifies, takes message, notifies agent
  | "qualify_callback";  // AI qualifies, offers to schedule a callback
// What the AI does after hours
export type AfterHoursVoiceMode =
  | "ai_take_message"    // AI answers and takes a message
  | "ai_offer_callback"  // AI answers and offers to schedule a callback
  | "voicemail";         // Play voicemail greeting and notify agent
// ElevenLabs voice clone lifecycle
export type VoiceCloneStatus = "none" | "pending" | "processing" | "ready" | "failed";

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
  // Voice AI fields
  voice_tier: VoiceTier;
  voice_name: string;             // Name the AI introduces itself as, e.g. "Sarah"
  voice_id: string;               // ElevenLabs voice ID for TTS
  voice_agent_id: string;         // ElevenLabs Conversational AI agent ID (optional streaming mode)
  call_handling_mode: CallHandlingMode;
  after_hours_voice_mode: AfterHoursVoiceMode;
  voice_clone_status: VoiceCloneStatus;
  voice_clone_voice_id: string;   // ElevenLabs voice ID for the cloned voice
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

// Default ElevenLabs voice: Rachel — calm, professional female voice
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

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
  // Voice defaults
  voice_tier: "none",
  voice_name: "Sarah",
  voice_id: DEFAULT_VOICE_ID,
  voice_agent_id: "",
  call_handling_mode: "qualify_transfer",
  after_hours_voice_mode: "ai_take_message",
  voice_clone_status: "none",
  voice_clone_voice_id: "",
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

function normalizeVoiceTier(value: unknown): VoiceTier {
  if (typeof value !== "string") return DEFAULT_RECEPTIONIST_SETTINGS.voice_tier;
  const v = value.trim().toLowerCase();
  if (v === "voice" || v === "sms" || v === "none") return v;
  return DEFAULT_RECEPTIONIST_SETTINGS.voice_tier;
}

function normalizeCallHandlingMode(value: unknown): CallHandlingMode {
  if (typeof value !== "string") return DEFAULT_RECEPTIONIST_SETTINGS.call_handling_mode;
  const v = value.trim().toLowerCase();
  if (
    v === "qualify_transfer" ||
    v === "always_transfer" ||
    v === "always_ai" ||
    v === "qualify_callback"
  ) return v;
  return DEFAULT_RECEPTIONIST_SETTINGS.call_handling_mode;
}

function normalizeAfterHoursVoiceMode(value: unknown): AfterHoursVoiceMode {
  if (typeof value !== "string") return DEFAULT_RECEPTIONIST_SETTINGS.after_hours_voice_mode;
  const v = value.trim().toLowerCase();
  if (v === "ai_take_message" || v === "ai_offer_callback" || v === "voicemail") return v;
  return DEFAULT_RECEPTIONIST_SETTINGS.after_hours_voice_mode;
}

function normalizeVoiceCloneStatus(value: unknown): VoiceCloneStatus {
  if (typeof value !== "string") return DEFAULT_RECEPTIONIST_SETTINGS.voice_clone_status;
  const v = value.trim().toLowerCase();
  if (
    v === "none" ||
    v === "pending" ||
    v === "processing" ||
    v === "ready" ||
    v === "failed"
  ) return v;
  return DEFAULT_RECEPTIONIST_SETTINGS.voice_clone_status;
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
    // Voice fields
    voice_tier: normalizeVoiceTier(raw.voice_tier),
    voice_name: readString(raw.voice_name, DEFAULT_RECEPTIONIST_SETTINGS.voice_name),
    voice_id: readString(raw.voice_id, DEFAULT_RECEPTIONIST_SETTINGS.voice_id),
    voice_agent_id: readString(raw.voice_agent_id),
    call_handling_mode: normalizeCallHandlingMode(raw.call_handling_mode),
    after_hours_voice_mode: normalizeAfterHoursVoiceMode(raw.after_hours_voice_mode),
    voice_clone_status: normalizeVoiceCloneStatus(raw.voice_clone_status),
    voice_clone_voice_id: readString(raw.voice_clone_voice_id),
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

export function isVoiceEnabled(settings: ReceptionistSettings): boolean {
  return settings.voice_tier === "voice" && settings.receptionist_enabled;
}

export function activeVoiceId(settings: ReceptionistSettings): string {
  // Use cloned voice if ready, otherwise fall back to preset voice
  if (settings.voice_clone_status === "ready" && settings.voice_clone_voice_id) {
    return settings.voice_clone_voice_id;
  }
  return settings.voice_id || DEFAULT_RECEPTIONIST_SETTINGS.voice_id;
}
