export type QuestionnaireInputType = "text" | "email" | "tel" | "textarea";

export type QuestionnaireQuestion = {
  id: string;
  label: string;
  prompt: string;
  placeholder: string;
  crm_field: string;
  required: boolean;
  input_type: QuestionnaireInputType;
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
  { value: "contact_preference", label: "Contact Preference" },
  { value: "next_step", label: "Next Step" },
  { value: "notes", label: "Notes" },
  { value: "tags", label: "Tags" },
  { value: "external_id", label: "External ID" },
  { value: "source", label: "Source" },
];

const CORE_FIELD_SET = new Set(CORE_FIELD_OPTIONS.map((item) => item.value));

const INPUT_TYPE_SET = new Set<QuestionnaireInputType>([
  "text",
  "email",
  "tel",
  "textarea",
]);

const MAX_QUESTIONS = 30;

export const PREBUILT_QUESTIONNAIRE_CONFIG: QuestionnaireConfig = {
  version: 1,
  title: "Lead Intake Form",
  description:
    "Answer a few quick questions so our team can follow up with the best next step.",
  submit_label: "Submit Intake",
  success_message:
    "Thanks, we received your details and will reach out with next steps shortly.",
  questions: [
    {
      id: "full_name",
      label: "Full Name",
      prompt: "What is your full name?",
      placeholder: "Jane Doe",
      crm_field: "full_name",
      required: true,
      input_type: "text",
    },
    {
      id: "ig_username",
      label: "Instagram Handle",
      prompt: "What is your Instagram handle? (optional)",
      placeholder: "@janedoe",
      crm_field: "ig_username",
      required: false,
      input_type: "text",
    },
    {
      id: "email",
      label: "Email",
      prompt: "What email should we use?",
      placeholder: "jane@email.com",
      crm_field: "email",
      required: true,
      input_type: "email",
    },
    {
      id: "phone",
      label: "Phone",
      prompt: "What is the best phone number?",
      placeholder: "(555) 555-5555",
      crm_field: "phone",
      required: true,
      input_type: "tel",
    },
    {
      id: "intent",
      label: "Intent",
      prompt: "What are you looking for exactly (buy/sell/invest)?",
      placeholder: "Buy a primary home",
      crm_field: "intent",
      required: false,
      input_type: "text",
    },
    {
      id: "contact_preference",
      label: "Contact Preference",
      prompt: "How do you prefer us to follow up?",
      placeholder: "Text first, then email",
      crm_field: "contact_preference",
      required: false,
      input_type: "text",
    },
    {
      id: "next_step",
      label: "Next Step",
      prompt: "What is the best next step for you right now?",
      placeholder: "Schedule a call this week",
      crm_field: "next_step",
      required: false,
      input_type: "text",
    },
    {
      id: "source",
      label: "How did you find us?",
      prompt: "Where did you hear about us?",
      placeholder: "Instagram, referral, Zillow, Google, etc.",
      crm_field: "source",
      required: false,
      input_type: "text",
    },
    {
      id: "timeline",
      label: "Timeline",
      prompt: "What is your ideal timeline to move?",
      placeholder: "30-60 days",
      crm_field: "timeline",
      required: false,
      input_type: "text",
    },
    {
      id: "budget_range",
      label: "Budget Range",
      prompt: "What budget range are you targeting?",
      placeholder: "$400k - $550k",
      crm_field: "budget_range",
      required: false,
      input_type: "text",
    },
    {
      id: "location_area",
      label: "Location",
      prompt: "Which location or neighborhood is best for you?",
      placeholder: "Austin - South Congress",
      crm_field: "location_area",
      required: false,
      input_type: "text",
    },
    {
      id: "notes",
      label: "Anything Else We Should Know?",
      prompt: "Share any additional context that helps us support you better.",
      placeholder: "Must have 4 bedrooms, near good schools, open to fixer-upper.",
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
    questions: config.questions.map((question) => ({ ...question })),
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
    return "Lead Intake Form";
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
  const placeholder = safeText(raw.placeholder, 120);
  const crmField = normalizeCrmField(raw.crm_field, fallback.crm_field);
  const inputType = normalizeInputType(raw.input_type, fallback.input_type);
  const required = Boolean(raw.required);

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
      : DEFAULT_QUESTIONNAIRE_CONFIG.questions.map((question, index) =>
          normalizeQuestion(question, index, ids)
        ).filter((question): question is QuestionnaireQuestion => question !== null);

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
