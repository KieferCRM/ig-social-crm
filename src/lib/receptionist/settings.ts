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
// Which shared ElevenLabs agent preset to use, or "custom" for a user-supplied agent ID
export type VoicePreset = "female" | "male" | "custom";
// How the AI handles inbound calls
export type CallHandlingMode =
  | "qualify_transfer"   // legacy — kept for backward compat
  | "always_transfer"    // legacy — kept for backward compat
  | "always_ai"          // Full AI assistant: qualifies, answers questions, handles end-to-end
  | "qualify_callback"   // Smart voicemail: listens, takes message, confirms callback
  | "message_book";      // Smart voicemail + booking: same as qualify_callback + offers to schedule
// What the AI does after hours
export type AfterHoursVoiceMode =
  | "ai_take_message"    // AI answers and takes a message
  | "ai_offer_callback"  // AI answers and offers to schedule a callback
  | "voicemail";         // Play voicemail greeting and notify agent
// ElevenLabs voice clone lifecycle
export type VoiceCloneStatus = "none" | "pending" | "processing" | "ready" | "failed";
// PA autonomy mode: autopilot = acts immediately, copilot = drafts for agent approval
export type PaMode = "autopilot" | "copilot";

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
  voice_preset: VoicePreset;      // Which voice to use: female, male, or custom
  voice_name: string;             // Name the AI introduces itself as, e.g. "Sarah"
  voice_id: string;               // ElevenLabs voice ID for TTS
  voice_agent_id: string;         // ElevenLabs Conversational AI agent ID (only used when voice_preset = "custom")
  call_handling_mode: CallHandlingMode;
  after_hours_voice_mode: AfterHoursVoiceMode;
  voice_clone_status: VoiceCloneStatus;
  voice_clone_voice_id: string;   // ElevenLabs voice ID for the cloned voice
  elevenlabs_phone_number_id: string; // ElevenLabs phone number ID — used to swap agent when voice preset changes
  pa_mode: PaMode;                // How the PA handles lead replies
  sms_tone: string;               // Secretary SMS personality/tone description
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
  voice_tier: "voice",
  voice_preset: "female",
  voice_name: "Sarah",
  voice_id: DEFAULT_VOICE_ID,
  voice_agent_id: "",
  call_handling_mode: "qualify_transfer",
  after_hours_voice_mode: "ai_take_message",
  voice_clone_status: "none",
  voice_clone_voice_id: "",
  elevenlabs_phone_number_id: "",
  pa_mode: "copilot",
  sms_tone: "",
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

function normalizeVoicePreset(value: unknown): VoicePreset {
  if (typeof value !== "string") return DEFAULT_RECEPTIONIST_SETTINGS.voice_preset;
  const v = value.trim().toLowerCase();
  if (v === "female" || v === "male" || v === "custom") return v;
  return DEFAULT_RECEPTIONIST_SETTINGS.voice_preset;
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
    v === "qualify_callback" ||
    v === "message_book"
  ) return v;
  return DEFAULT_RECEPTIONIST_SETTINGS.call_handling_mode;
}

/**
 * Returns the full behavioral instructions for the AI based on call handling mode.
 * This is injected as {{call_instructions}} in the ElevenLabs system prompt.
 */
export function getCallInstructions(mode: CallHandlingMode, agentFirstName: string): string {
  const name = agentFirstName || "your agent";

  switch (mode) {
    case "message_book":
      return `You are ${name}'s assistant answering their phone. You are a real person — never say you are an AI or a bot. If asked directly, say you are ${name}'s assistant.

Your job on this call:
1. Answer warmly and let them talk first. Most callers know why they're calling — don't cut them off with questions.
2. Acknowledge what they said naturally. "Got it", "Absolutely", "Of course" — whatever fits.
3. Get their name. Ask naturally: "Can I get your name?"
4. You already have their callback number. Only ask for a different one if they specifically mention it.
5. Ask: "While I have you — would you like to get something on the calendar? ${name} can do a quick call, a showing, or a FaceTime."
6. If yes: get their preferred day and time.
7. Close every call the same way: "${name} will personally get back to you within 24 hours."

If they mention a specific property or listing — do not ask if they want to buy or sell. Ask which property they're calling about if it's not clear, then move on to getting their name.
If they ask a question you don't know — price, availability, showing time — say ${name} will have that answer when they call back.
Keep responses short. One or two sentences at a time.`;

    case "always_ai":
      return `You are ${name}'s assistant answering their phone. You are a real person — never say you are an AI or a bot. If asked directly, say you are ${name}'s assistant.

Your job on this call:
1. Answer warmly and let them explain why they're calling.
2. Ask natural follow-up questions to understand what they need: are they buying, selling, or both? What area? What's their timeline?
3. Get their name. Ask naturally: "Can I get your name?"
4. You already have their callback number. Only ask for a different one if they mention it.
5. Offer to get something on the calendar — a call, showing, or FaceTime with ${name}.
6. If yes: get their preferred day and time.
7. Close: "${name} will personally follow up within 24 hours."

If they mention a specific property or listing — do not ask if they want to buy or sell. Ask which property they're calling about if it's not clear.
If they ask something you don't know — specific price, MLS details, contract terms — say ${name} will have that answer when they call back.
Keep responses conversational. One or two sentences at a time.`;

    // qualify_callback, qualify_transfer, always_transfer — all fall back to smart voicemail
    default:
      return `You are ${name}'s assistant answering their phone. You are a real person — never say you are an AI or a bot. If asked directly, say you are ${name}'s assistant.

Your only job on this call:
1. Answer warmly and let them talk. Don't interrupt — let them explain why they're calling first.
2. Acknowledge what they said naturally. "Got it", "Absolutely", "Of course" — whatever fits.
3. Get their name. Ask naturally: "Can I get your name?"
4. You already have their callback number from when they called. Only ask for a different one if they specifically say to reach them somewhere else.
5. Close every call the same way: "${name} will personally get back to you within 24 hours."

If they mention a specific property or listing — do not ask if they want to buy or sell. Ask which property they're calling about if it's not clear, then move on to getting their name.
If they ask a question you don't know — price, availability, showing time — say ${name} will have that answer when they call back.
Keep responses short. One or two sentences at a time. Real assistants don't give speeches.`;
  }
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
    voice_preset: normalizeVoicePreset(raw.voice_preset),
    voice_name: readString(raw.voice_name, DEFAULT_RECEPTIONIST_SETTINGS.voice_name),
    voice_id: readString(raw.voice_id, DEFAULT_RECEPTIONIST_SETTINGS.voice_id),
    voice_agent_id: readString(raw.voice_agent_id),
    call_handling_mode: normalizeCallHandlingMode(raw.call_handling_mode),
    after_hours_voice_mode: normalizeAfterHoursVoiceMode(raw.after_hours_voice_mode),
    voice_clone_status: normalizeVoiceCloneStatus(raw.voice_clone_status),
    voice_clone_voice_id: readString(raw.voice_clone_voice_id),
    elevenlabs_phone_number_id: readString(raw.elevenlabs_phone_number_id),
    pa_mode: raw.pa_mode === "autopilot" ? "autopilot" : "copilot",
    sms_tone: readString(raw.sms_tone),
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

/**
 * Returns the ElevenLabs agent ID to use for this user's voice setting.
 * - "female" → shared female agent from env
 * - "male"   → shared male agent from env
 * - "custom" → the agent ID the user pasted into their settings
 */
export function resolveVoiceAgentId(settings: ReceptionistSettings): string {
  // "My Voice" (custom) uses voice cloning via TTS — skip the streaming agent so the clone is heard
  if (settings.voice_preset === "custom") return "";
  if (settings.voice_preset === "male") return (process.env.ELEVENLABS_AGENT_MALE || "").trim();
  // default: female
  return (process.env.ELEVENLABS_AGENT_FEMALE || "").trim();
}

export function activeVoiceId(settings: ReceptionistSettings): string {
  // Use cloned voice if ready, otherwise fall back to preset voice
  if (settings.voice_clone_status === "ready" && settings.voice_clone_voice_id) {
    return settings.voice_clone_voice_id;
  }
  return settings.voice_id || DEFAULT_RECEPTIONIST_SETTINGS.voice_id;
}
