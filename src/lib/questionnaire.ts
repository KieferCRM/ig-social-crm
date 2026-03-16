export type QuestionnaireInputType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio";

export type QuestionnaireQuestion = {
  id: string;
  label: string;
  prompt: string;
  placeholder: string;
  crm_field: string;
  required: boolean;
  input_type: QuestionnaireInputType;
  options?: string[];
};

export type QuestionnaireConfig = {
  version: 1;
  title: string;
  description: string;
  submit_label: string;
  success_message: string;
  questions: QuestionnaireQuestion[];
};

export const QUESTIONNAIRE_SETTINGS_KEY = "intake_questionnaire";

export const CORE_FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "full_name", label: "Full Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "ig_username", label: "Social Handle" },
  { value: "intent", label: "Intent" },
  { value: "timeline", label: "Timeline" },
  { value: "budget_range", label: "Budget Range" },
  { value: "location_area", label: "Location / Area" },
  { value: "property_context", label: "Property / Context" },
  { value: "contact_preference", label: "Contact Preference" },
  { value: "source", label: "Source" },
  { value: "notes", label: "Notes" },
  { value: "financing_status", label: "Financing Status" },
  { value: "seller_readiness", label: "Seller Readiness" },
  { value: "agency_status", label: "Working With Agent" },
  { value: "property_type", label: "Property Type" },
];

const CORE_FIELD_SET = new Set(CORE_FIELD_OPTIONS.map((item) => item.value));

const INPUT_TYPE_SET = new Set<QuestionnaireInputType>([
  "text",
  "email",
  "tel",
  "textarea",
  "select",
  "radio",
]);

const MAX_QUESTIONS = 30;

export const PREBUILT_QUESTIONNAIRE_CONFIG: QuestionnaireConfig = {
  version: 1,
  title: "Real Estate Intake",
  description:
    "Share a few details so the agent can review your inquiry and follow up with the right next step.",
  submit_label: "Submit inquiry",
  success_message:
    "Thanks, your inquiry is in. The agent will review it and follow up with the best next step.",
  questions: [
    {
      id: "intent",
      label: "What are you looking to do?",
      prompt: "What are you looking to do?",
      placeholder: "Select one",
      crm_field: "intent",
      required: true,
      input_type: "select",
      options: ["Buy", "Sell", "Rent", "Invest", "Not sure"],
    },
    {
      id: "timeline",
      label: "When are you hoping to move or act?",
      prompt: "When are you hoping to move or act?",
      placeholder: "Select one",
      crm_field: "timeline",
      required: true,
      input_type: "select",
      options: ["ASAP", "0-30 days", "1-3 months", "3-6 months", "6+ months"],
    },
    {
      id: "location_area",
      label: "What area, neighborhood, or property is this about?",
      prompt: "What area, neighborhood, or property is this about?",
      placeholder: "East Nashville, Brentwood, or 123 Main St",
      crm_field: "location_area",
      required: true,
      input_type: "text",
    },
    {
      id: "budget_range",
      label: "What budget or price range are you thinking about?",
      prompt: "What budget or price range are you thinking about?",
      placeholder: "Select one",
      crm_field: "budget_range",
      required: false,
      input_type: "select",
      options: [
        "Under $250k",
        "$250k-$500k",
        "$500k-$750k",
        "$750k-$1M",
        "$1M+",
      ],
    },
    {
      id: "full_name",
      label: "Full name",
      prompt: "What is your full name?",
      placeholder: "Jordan Mitchell",
      crm_field: "full_name",
      required: true,
      input_type: "text",
    },
    {
      id: "phone",
      label: "Best phone number",
      prompt: "What is the best phone number to reach you?",
      placeholder: "(615) 555-0182",
      crm_field: "phone",
      required: true,
      input_type: "tel",
    },
    {
      id: "email",
      label: "Email",
      prompt: "What email should we use?",
      placeholder: "jordan@email.com",
      crm_field: "email",
      required: false,
      input_type: "email",
    },
    {
      id: "contact_preference",
      label: "Preferred contact method",
      prompt: "How should the agent follow up?",
      placeholder: "Select one",
      crm_field: "contact_preference",
      required: true,
      input_type: "radio",
      options: ["Call", "Text", "Email"],
    },
    {
      id: "source",
      label: "How did you find us?",
      prompt: "How did you find us?",
      placeholder: "Select one",
      crm_field: "source",
      required: false,
      input_type: "select",
      options: [
        "Instagram",
        "Facebook",
        "TikTok",
        "Website",
        "Open House",
        "Referral",
        "Call/Text",
        "Other",
      ],
    },
    {
      id: "notes",
      label: "Anything else we should know?",
      prompt: "Anything else we should know?",
      placeholder: "Anything helpful before the agent follows up.",
      crm_field: "notes",
      required: false,
      input_type: "textarea",
    },
  ],
};

export const DEFAULT_QUESTIONNAIRE_CONFIG: QuestionnaireConfig = PREBUILT_QUESTIONNAIRE_CONFIG;

export function cloneQuestionnaireConfig(config: QuestionnaireConfig): QuestionnaireConfig {
  return {
    ...config,
    questions: config.questions.map((question) => ({
      ...question,
      options: question.options ? [...question.options] : undefined,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeLegacyTitle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (
    normalized === "get matched with off-market opportunities" ||
    normalized.includes("off-market")
  ) {
    return "Real Estate Intake";
  }
  return value;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeInputType(value: unknown, fallback: QuestionnaireInputType): QuestionnaireInputType {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase() as QuestionnaireInputType;
  if (INPUT_TYPE_SET.has(normalized)) return normalized;
  return fallback;
}

function normalizeOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((item) => safeText(item, 80))
    .filter((item) => item.length > 0)
    .slice(0, 12);
  return options.length > 0 ? options : undefined;
}

function normalizeCrmField(value: unknown, fallback: string): string {
  const raw = safeText(value, 120).toLowerCase();
  if (CORE_FIELD_SET.has(raw)) {
    return raw;
  }

  const customKey = raw.startsWith("custom.") ? raw.slice("custom.".length) : raw;
  const normalized = slugify(customKey || fallback);
  return `custom.${normalized || "field"}`;
}

export function isCoreQuestionField(field: string): boolean {
  return CORE_FIELD_SET.has(field);
}

function normalizeQuestion(
  input: unknown,
  index: number,
  ids: Set<string>
): QuestionnaireQuestion | null {
  const fallback = DEFAULT_QUESTIONNAIRE_CONFIG.questions[
    Math.min(index, DEFAULT_QUESTIONNAIRE_CONFIG.questions.length - 1)
  ];

  const raw = isRecord(input) ? input : {};
  const label = safeText(raw.label, 60) || fallback.label;
  const prompt = safeText(raw.prompt, 240) || label;
  const placeholder = safeText(raw.placeholder, 120) || fallback.placeholder;
  const crmField = normalizeCrmField(raw.crm_field, fallback.crm_field);
  const inputType = normalizeInputType(raw.input_type, fallback.input_type);
  const required = Boolean(raw.required);
  const options = normalizeOptions(raw.options) || fallback.options;

  const baseId = slugify(safeText(raw.id, 60)) || slugify(label) || `question_${index + 1}`;
  let id = baseId;
  let suffix = 2;
  while (ids.has(id)) {
    id = `${baseId}_${suffix}`;
    suffix += 1;
  }
  ids.add(id);

  if (!prompt) return null;

  return {
    id,
    label,
    prompt,
    placeholder,
    crm_field: crmField,
    required,
    input_type: inputType,
    options,
  };
}

export function normalizeQuestionnaireConfig(input: unknown): QuestionnaireConfig {
  const raw = isRecord(input) ? input : {};
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const ids = new Set<string>();

  const questions: QuestionnaireQuestion[] = [];
  for (let i = 0; i < rawQuestions.length && questions.length < MAX_QUESTIONS; i++) {
    const normalized = normalizeQuestion(rawQuestions[i], i, ids);
    if (normalized) {
      questions.push(normalized);
    }
  }

  const resolvedQuestions =
    questions.length > 0
      ? questions
      : DEFAULT_QUESTIONNAIRE_CONFIG.questions
          .map((question, index) => normalizeQuestion(question, index, ids))
          .filter((question): question is QuestionnaireQuestion => question !== null);

  const normalizedTitle = sanitizeLegacyTitle(safeText(raw.title, 120));

  return {
    version: 1,
    title: normalizedTitle || DEFAULT_QUESTIONNAIRE_CONFIG.title,
    description: safeText(raw.description, 300) || DEFAULT_QUESTIONNAIRE_CONFIG.description,
    submit_label: safeText(raw.submit_label, 40) || DEFAULT_QUESTIONNAIRE_CONFIG.submit_label,
    success_message:
      safeText(raw.success_message, 300) || DEFAULT_QUESTIONNAIRE_CONFIG.success_message,
    questions: resolvedQuestions,
  };
}

export function readQuestionnaireFromAgentSettings(settings: unknown): QuestionnaireConfig {
  if (!isRecord(settings)) {
    return DEFAULT_QUESTIONNAIRE_CONFIG;
  }
  return normalizeQuestionnaireConfig(settings[QUESTIONNAIRE_SETTINGS_KEY]);
}

export function mergeQuestionnaireIntoAgentSettings(
  settings: unknown,
  config: unknown
): Record<string, unknown> {
  const base = isRecord(settings) ? { ...settings } : {};
  base[QUESTIONNAIRE_SETTINGS_KEY] = normalizeQuestionnaireConfig(config);
  return base;
}
