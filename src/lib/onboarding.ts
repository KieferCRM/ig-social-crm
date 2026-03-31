type AgentIdentity = {
  agentId: string;
  fullName?: string | null;
  email?: string | null;
};

export const ONBOARDING_SETTINGS_KEY = "onboarding";

export const ACCOUNT_TYPE_VALUES = [
  "solo_agent",
  "off_market_agent",
  "team_brokerage",
] as const;

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];

export type OnboardingState = {
  has_completed_onboarding: boolean;
  completed_at: string;
  has_seeded_sample_workspace_data: boolean;
  account_type: AccountType | null;
  account_type_selected_at: string;
};

export type OnboardingStep = "account_type" | "profile" | "slug" | "social" | "complete";

type OnboardingStepMeta = {
  step: number;
  total: number;
  label: string;
};

const ONBOARDING_STEPS: Record<OnboardingStep, OnboardingStepMeta> = {
  account_type: { step: 1, total: 5, label: "Workspace type" },
  profile: { step: 2, total: 5, label: "Your profile" },
  slug: { step: 3, total: 5, label: "Your slug" },
  social: { step: 4, total: 5, label: "Social profiles" },
  complete: { step: 5, total: 5, label: "You're all set" },
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function deriveAgentSlug(identity: AgentIdentity): string {
  const namePart =
    (identity.fullName && slugify(identity.fullName)) ||
    (identity.email && slugify(identity.email.split("@")[0] || "")) ||
    "agent";
  const idPart = identity.agentId.slice(0, 8).toLowerCase();
  return `${namePart}-${idPart}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readOnboardingStateFromAgentSettings(settings: unknown): OnboardingState {
  const record = asRecord(settings);
  const raw = record ? asRecord(record[ONBOARDING_SETTINGS_KEY]) : null;
  const hasCompleted =
    typeof raw?.has_completed_onboarding === "boolean"
      ? raw.has_completed_onboarding
      : false;
  const completedAt =
    typeof raw?.completed_at === "string" ? raw.completed_at.trim() : "";
  const accountType =
    typeof raw?.account_type === "string" &&
    (ACCOUNT_TYPE_VALUES as readonly string[]).includes(raw.account_type)
      ? (raw.account_type as AccountType)
      : null;
  const accountTypeSelectedAt =
    typeof raw?.account_type_selected_at === "string"
      ? raw.account_type_selected_at.trim()
      : "";

  return {
    has_completed_onboarding: hasCompleted,
    completed_at: completedAt,
    has_seeded_sample_workspace_data:
      typeof raw?.has_seeded_sample_workspace_data === "boolean"
        ? raw.has_seeded_sample_workspace_data
        : false,
    account_type: accountType,
    account_type_selected_at: accountTypeSelectedAt,
  };
}

export function needsAccountTypeSetup(state: OnboardingState): boolean {
  return !state.account_type && !state.has_completed_onboarding;
}

export function getOnboardingGuardRedirectPath(
  state: OnboardingState,
  step: Exclude<OnboardingStep, "complete">
): string | null {
  if (state.has_completed_onboarding) return "/app";
  if (step === "account_type") return null;
  if (!state.account_type) return "/setup/account-type";
  return null;
}

export function getOnboardingCompletionGuardRedirectPath(state: OnboardingState): string | null {
  if (state.has_completed_onboarding) return null;
  if (!state.account_type) return "/setup/account-type";
  return "/setup/social";
}

export function getOnboardingStepKicker(step: OnboardingStep): string {
  const meta = ONBOARDING_STEPS[step];
  return `Step ${meta.step} of ${meta.total} — ${meta.label}`;
}

export function mergeOnboardingIntoAgentSettings(
  settings: unknown,
  patch: Partial<OnboardingState>
): Record<string, unknown> {
  const base = asRecord(settings) ? { ...(settings as Record<string, unknown>) } : {};
  const current = readOnboardingStateFromAgentSettings(base);
  base[ONBOARDING_SETTINGS_KEY] = {
    ...current,
    ...patch,
  };
  return base;
}
