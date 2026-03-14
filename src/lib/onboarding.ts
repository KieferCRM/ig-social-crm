type AgentIdentity = {
  agentId: string;
  fullName?: string | null;
  email?: string | null;
};

export const ONBOARDING_SETTINGS_KEY = "onboarding";

export type OnboardingState = {
  has_completed_onboarding: boolean;
  completed_at: string;
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

  return {
    has_completed_onboarding: hasCompleted,
    completed_at: completedAt,
  };
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
