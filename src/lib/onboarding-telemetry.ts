import type { AccountType, OnboardingStep } from "@/lib/onboarding";

export type OnboardingTelemetryEventName =
  | "step_view"
  | "step_complete"
  | "onboarding_complete";

export type OnboardingTelemetryStatus = "saved" | "skipped" | "completed";

export type OnboardingTelemetryInput = {
  event_name: OnboardingTelemetryEventName;
  step: OnboardingStep;
  account_type?: AccountType | null;
  status?: OnboardingTelemetryStatus;
  surface?: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string;
};

export async function recordOnboardingEvent(input: OnboardingTelemetryInput): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/onboarding/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        occurred_at: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch {
    // Telemetry must never block onboarding.
  }
}
