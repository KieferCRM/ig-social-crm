export const WORKSPACE_SETTINGS_KEY = "workspace_v1";
export const WORKSPACE_DOCUMENT_BUCKET = "workspace-documents";

export type HotLeadNotificationMode =
  | "immediate"
  | "business_hours"
  | "daily_summary"
  | "crm_only";

export type OperatorPath = "real_estate" | "wholesaler";

export type SocialScriptCategory =
  | "seller_outreach"
  | "buyer_outreach"
  | "buyer_blast"
  | "follow_up";

export type SocialScript = {
  id: string;
  title: string;
  body: string;
  category: SocialScriptCategory;
};

export type WorkspaceDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  deal_id: string;
  lead_id: string;
  tags: string[];
  status: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
};

export type WorkspaceSettings = {
  booking_link: string;
  hot_lead_notification_mode: HotLeadNotificationMode;
  hot_lead_business_hours_start: string;
  hot_lead_business_hours_end: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  saved_scripts: SocialScript[];
  documents: WorkspaceDocument[];
  operator_path: OperatorPath;
};

const DEFAULT_SCRIPTS: SocialScript[] = [
  {
    id: "seller-outreach-default",
    title: "Seller outreach opener",
    category: "seller_outreach",
    body:
      "Hi, thanks for reaching out. I looked over what you shared and would love to learn a little more about the property and your timeframe. Would a quick call or text conversation be easier today?",
  },
  {
    id: "buyer-outreach-default",
    title: "Buyer reply",
    category: "buyer_outreach",
    body:
      "Thanks for reaching out. I can help narrow this down quickly if you send me your area, budget, and timeframe. If you want, we can also jump on a quick call.",
  },
  {
    id: "buyer-blast-default",
    title: "Buyer blast",
    category: "buyer_blast",
    body:
      "New opportunity available. Reply if you want the address, price guidance, and access details.",
  },
  {
    id: "follow-up-default",
    title: "General follow-up",
    category: "follow_up",
    body:
      "Checking back in to see if this is still on your radar. If the timing changed, no problem — I can adjust the follow-up plan.",
  },
];

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  booking_link: "",
  hot_lead_notification_mode: "business_hours",
  hot_lead_business_hours_start: "09:00",
  hot_lead_business_hours_end: "18:00",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",
  saved_scripts: DEFAULT_SCRIPTS,
  documents: [],
  operator_path: "real_estate",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
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

function normalizeNotificationMode(value: unknown): HotLeadNotificationMode {
  if (typeof value !== "string") return DEFAULT_WORKSPACE_SETTINGS.hot_lead_notification_mode;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "immediate" ||
    normalized === "business_hours" ||
    normalized === "daily_summary" ||
    normalized === "crm_only"
  ) {
    return normalized;
  }
  return DEFAULT_WORKSPACE_SETTINGS.hot_lead_notification_mode;
}

function normalizeOperatorPath(value: unknown): OperatorPath {
  if (value === "wholesaler") return "wholesaler";
  return "real_estate";
}

function normalizeScriptCategory(value: unknown): SocialScriptCategory {
  if (typeof value !== "string") return "follow_up";
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "seller_outreach" ||
    normalized === "buyer_outreach" ||
    normalized === "buyer_blast" ||
    normalized === "follow_up"
  ) {
    return normalized;
  }
  return "follow_up";
}

function normalizeScripts(value: unknown): SocialScript[] {
  if (!Array.isArray(value)) return [...DEFAULT_SCRIPTS];
  const scripts = value
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) return null;
      const title = readString(record.title);
      const body = readString(record.body);
      if (!title || !body) return null;
      return {
        id: readString(record.id) || `script-${index + 1}`,
        title,
        body,
        category: normalizeScriptCategory(record.category),
      };
    })
    .filter((item): item is SocialScript => Boolean(item))
    .slice(0, 12);
  return scripts.length > 0 ? scripts : [...DEFAULT_SCRIPTS];
}

function normalizeStringArray(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function normalizeDocuments(value: unknown): WorkspaceDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const id = readString(record.id);
      const fileName = readString(record.file_name);
      const storagePath = readString(record.storage_path);
      if (!id || !fileName || !storagePath) return null;
      return {
        id,
        file_name: fileName,
        storage_path: storagePath,
        file_type: readString(record.file_type, "other") || "other",
        deal_id: readString(record.deal_id),
        lead_id: readString(record.lead_id),
        tags: normalizeStringArray(record.tags),
        status: readString(record.status, "draft") || "draft",
        mime_type: readString(record.mime_type),
        size_bytes:
          typeof record.size_bytes === "number" && Number.isFinite(record.size_bytes)
            ? record.size_bytes
            : 0,
        uploaded_at: readString(record.uploaded_at),
        uploaded_by: readString(record.uploaded_by),
      };
    })
    .filter((item): item is WorkspaceDocument => Boolean(item))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

export function normalizeWorkspaceSettings(input: unknown): WorkspaceSettings {
  const raw = asRecord(input) || {};
  return {
    booking_link: readString(raw.booking_link),
    hot_lead_notification_mode: normalizeNotificationMode(raw.hot_lead_notification_mode),
    hot_lead_business_hours_start: normalizeHourMinute(
      readString(
        raw.hot_lead_business_hours_start,
        DEFAULT_WORKSPACE_SETTINGS.hot_lead_business_hours_start
      ),
      DEFAULT_WORKSPACE_SETTINGS.hot_lead_business_hours_start
    ),
    hot_lead_business_hours_end: normalizeHourMinute(
      readString(
        raw.hot_lead_business_hours_end,
        DEFAULT_WORKSPACE_SETTINGS.hot_lead_business_hours_end
      ),
      DEFAULT_WORKSPACE_SETTINGS.hot_lead_business_hours_end
    ),
    instagram_url: readString(raw.instagram_url),
    facebook_url: readString(raw.facebook_url),
    tiktok_url: readString(raw.tiktok_url),
    saved_scripts: normalizeScripts(raw.saved_scripts),
    documents: normalizeDocuments(raw.documents),
    operator_path: normalizeOperatorPath(raw.operator_path),
  };
}

export function readWorkspaceSettingsFromAgentSettings(settings: unknown): WorkspaceSettings {
  const record = asRecord(settings);
  if (!record) return { ...DEFAULT_WORKSPACE_SETTINGS };
  return normalizeWorkspaceSettings(record[WORKSPACE_SETTINGS_KEY]);
}

export function mergeWorkspaceSettingsIntoAgentSettings(
  settings: unknown,
  patch: unknown
): Record<string, unknown> {
  const base = asRecord(settings) ? { ...(settings as Record<string, unknown>) } : {};
  const current = readWorkspaceSettingsFromAgentSettings(base);
  const nextPatch = asRecord(patch) || {};
  base[WORKSPACE_SETTINGS_KEY] = normalizeWorkspaceSettings({
    ...current,
    ...nextPatch,
  });
  return base;
}

export function withWorkspaceDocument(
  settings: unknown,
  document: WorkspaceDocument
): Record<string, unknown> {
  const current = readWorkspaceSettingsFromAgentSettings(settings);
  const documents = [
    document,
    ...current.documents.filter((item) => item.id !== document.id),
  ].slice(0, 250);
  return mergeWorkspaceSettingsIntoAgentSettings(settings, { documents });
}

export function withoutWorkspaceDocument(
  settings: unknown,
  documentId: string
): Record<string, unknown> {
  const current = readWorkspaceSettingsFromAgentSettings(settings);
  return mergeWorkspaceSettingsIntoAgentSettings(settings, {
    documents: current.documents.filter((item) => item.id !== documentId),
  });
}
