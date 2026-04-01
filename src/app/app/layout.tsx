import { type ReactNode } from "react";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import AppShellClient from "./AppShellClient";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialAccountType: import("@/lib/onboarding").AccountType | null = null;

  if (user) {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("settings")
      .eq("id", user.id)
      .maybeSingle();

    const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
    initialAccountType = onboardingState.account_type;
  }

  return <AppShellClient initialAccountType={initialAccountType}>{children}</AppShellClient>;
}
