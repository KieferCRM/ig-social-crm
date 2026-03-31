"use client";

import { useEffect } from "react";
import type { AccountType } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-telemetry";

type Props = {
  accountType: AccountType | null;
};

export default function CompleteAnalytics({ accountType }: Props) {
  useEffect(() => {
    void recordOnboardingEvent({
      event_name: "step_view",
      step: "complete",
      account_type: accountType,
      surface: "setup/complete",
    });
  }, [accountType]);

  return null;
}
