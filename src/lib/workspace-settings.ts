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

export type ProfileTemplate = "wholesaler" | "agent";

export type ProfileTheme = {
  palette: string; // named palette key
  primary: string;
  primaryLight: string;
  accent: string;
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  line: string;
  heroBg: string;
};

export const PROFILE_PALETTES: Record<string, ProfileTheme> = {
  earthy: {
    palette: "earthy",
    primary: "#2d4a2d",
    primaryLight: "#3d6b3d",
    accent: "#7c5c3a",
    bg: "#faf8f4",
    surface: "#ffffff",
    ink: "#1c1c1c",
    inkMuted: "#5a5a4a",
    line: "#e0d8c8",
    heroBg: "linear-gradient(160deg,#2d4a2d 0%,#1a2e1a 60%,#0f1f0f 100%)",
  },
  modern: {
    palette: "modern",
    primary: "#1e293b",
    primaryLight: "#334155",
    accent: "#2563eb",
    bg: "#f8fafc",
    surface: "#ffffff",
    ink: "#0f172a",
    inkMuted: "#64748b",
    line: "#e2e8f0",
    heroBg: "linear-gradient(160deg,#1e293b 0%,#0f172a 100%)",
  },
  bold: {
    palette: "bold",
    primary: "#1a1a2e",
    primaryLight: "#16213e",
    accent: "#c9a84c",
    bg: "#f9f9f9",
    surface: "#ffffff",
    ink: "#1a1a2e",
    inkMuted: "#6b6b8a",
    line: "#e5e5f0",
    heroBg: "linear-gradient(160deg,#1a1a2e 0%,#0d0d1a 100%)",
  },
  warm: {
    palette: "warm",
    primary: "#92400e",
    primaryLight: "#b45309",
    accent: "#d97706",
    bg: "#fffbf5",
    surface: "#ffffff",
    ink: "#1c1008",
    inkMuted: "#78716c",
    line: "#fed7aa",
    heroBg: "linear-gradient(160deg,#92400e 0%,#5c2d0a 100%)",
  },
  clean: {
    palette: "clean",
    primary: "#0f766e",
    primaryLight: "#0d9488",
    accent: "#0891b2",
    bg: "#f0fdfa",
    surface: "#ffffff",
    ink: "#134e4a",
    inkMuted: "#5eead4",
    line: "#ccfbf1",
    heroBg: "linear-gradient(160deg,#0f766e 0%,#065f55 100%)",
  },
};

export type ProfileTestimonial = {
  id: string;
  author_name: string;
  author_role: string;
  text: string;
};

export type ProfileListing = {
  id: string;
  address: string;
  price: number;
  description: string;
  status: "active" | "pending" | "sold";
  image_url: string;
};

export type ProfileStat = {
  id: string;
  label: string;
  value: string;
};

export type ProfileHowItWorksStep = {
  id: string;
  step: string;
  title: string;
  body: string;
};

export type WorkspaceSettings = {
  booking_link: string;
  hot_lead_notification_mode: HotLeadNotificationMode;
  hot_lead_business_hours_start: string;
  hot_lead_business_hours_end: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  youtube_url: string;
  linkedin_url: string;
  saved_scripts: SocialScript[];
  documents: WorkspaceDocument[];
  operator_path: OperatorPath;
  // Public profile
  profile_template: ProfileTemplate;
  profile_company_name: string;
  profile_tagline: string;
  profile_bio: string;
  profile_headshot_url: string;
  profile_service_areas: string[];
  profile_testimonials: ProfileTestimonial[];
  profile_listings: ProfileListing[];
  profile_show_contact_form: boolean;
  profile_public: boolean;
  profile_stats: ProfileStat[];
  profile_how_it_works: ProfileHowItWorksStep[];
  profile_theme: ProfileTheme | null;
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
  youtube_url: "",
  linkedin_url: "",
  saved_scripts: DEFAULT_SCRIPTS,
  documents: [],
  operator_path: "real_estate",
  profile_template: "wholesaler",
  profile_company_name: "",
  profile_tagline: "",
  profile_bio: "",
  profile_headshot_url: "",
  profile_service_areas: [],
  profile_testimonials: [],
  profile_listings: [],
  profile_show_contact_form: true,
  profile_public: true,
  profile_stats: [],
  profile_how_it_works: [],
  profile_theme: null,
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
  if (typeof value === "string" && value.trim().toLowerCase() === "wholesaler") return "wholesaler";
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

function normalizeStats(value: unknown): ProfileStat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const id = readString(record.id);
      const label = readString(record.label);
      const val = readString(record.value);
      if (!id || !label || !val) return null;
      return { id, label, value: val };
    })
    .filter((item): item is ProfileStat => Boolean(item))
    .slice(0, 6);
}

function normalizeHowItWorks(value: unknown): ProfileHowItWorksStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const id = readString(record.id);
      const step = readString(record.step);
      const title = readString(record.title);
      const body = readString(record.body);
      if (!id || !title) return null;
      return { id, step, title, body };
    })
    .filter((item): item is ProfileHowItWorksStep => Boolean(item))
    .slice(0, 6);
}

function normalizeTheme(value: unknown): ProfileTheme | null {
  const record = asRecord(value);
  if (!record) return null;
  const palette = readString(record.palette);
  if (palette && PROFILE_PALETTES[palette]) {
    return {
      ...PROFILE_PALETTES[palette],
      primary: readString(record.primary) || PROFILE_PALETTES[palette].primary,
      primaryLight: readString(record.primaryLight) || PROFILE_PALETTES[palette].primaryLight,
      accent: readString(record.accent) || PROFILE_PALETTES[palette].accent,
      bg: readString(record.bg) || PROFILE_PALETTES[palette].bg,
      surface: readString(record.surface) || PROFILE_PALETTES[palette].surface,
      ink: readString(record.ink) || PROFILE_PALETTES[palette].ink,
      inkMuted: readString(record.inkMuted) || PROFILE_PALETTES[palette].inkMuted,
      line: readString(record.line) || PROFILE_PALETTES[palette].line,
      heroBg: readString(record.heroBg) || PROFILE_PALETTES[palette].heroBg,
    };
  }
  return null;
}

function normalizeProfileTemplate(value: unknown): ProfileTemplate {
  if (value === "agent") return "agent";
  return "wholesaler";
}

function normalizeTestimonials(value: unknown): ProfileTestimonial[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const id = readString(record.id);
      const author_name = readString(record.author_name);
      const text = readString(record.text);
      if (!id || !author_name || !text) return null;
      return { id, author_name, author_role: readString(record.author_role), text };
    })
    .filter((item): item is ProfileTestimonial => Boolean(item))
    .slice(0, 20);
}

function normalizeListings(value: unknown): ProfileListing[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const id = readString(record.id);
      const address = readString(record.address);
      if (!id || !address) return null;
      const rawStatus = readString(record.status);
      const status: ProfileListing["status"] =
        rawStatus === "pending" ? "pending" : rawStatus === "sold" ? "sold" : "active";
      return {
        id,
        address,
        price: typeof record.price === "number" ? record.price : 0,
        description: readString(record.description),
        status,
        image_url: readString(record.image_url),
      };
    })
    .filter((item): item is ProfileListing => Boolean(item))
    .slice(0, 50);
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
    youtube_url: readString(raw.youtube_url),
    linkedin_url: readString(raw.linkedin_url),
    saved_scripts: normalizeScripts(raw.saved_scripts),
    documents: normalizeDocuments(raw.documents),
    operator_path: normalizeOperatorPath(raw.operator_path),
    profile_template: normalizeProfileTemplate(raw.profile_template),
    profile_company_name: readString(raw.profile_company_name),
    profile_tagline: readString(raw.profile_tagline),
    profile_bio: readString(raw.profile_bio),
    profile_headshot_url: readString(raw.profile_headshot_url),
    profile_service_areas: normalizeStringArray(raw.profile_service_areas),
    profile_testimonials: normalizeTestimonials(raw.profile_testimonials),
    profile_listings: normalizeListings(raw.profile_listings),
    profile_show_contact_form:
      typeof raw.profile_show_contact_form === "boolean" ? raw.profile_show_contact_form : true,
    profile_public:
      typeof raw.profile_public === "boolean" ? raw.profile_public : true,
    profile_stats: normalizeStats(raw.profile_stats),
    profile_how_it_works: normalizeHowItWorks(raw.profile_how_it_works),
    profile_theme: normalizeTheme(raw.profile_theme),
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
