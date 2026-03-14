import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";
import { deriveAgentSlug, readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AgentRow = {
  full_name: string | null;
  email: string | null;
  settings: unknown;
};

function firstName(value: string | null | undefined): string {
  if (!value) return "there";
  const trimmed = value.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
}

export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: agentRow } = await supabase
    .from("agents")
    .select("full_name, email, settings")
    .eq("id", user.id)
    .maybeSingle();

  const typedAgent = (agentRow || null) as AgentRow | null;
  const onboardingState = readOnboardingStateFromAgentSettings(typedAgent?.settings || null);

  if (onboardingState.has_completed_onboarding) {
    redirect("/app");
  }

  const slug = deriveAgentSlug({
    agentId: user.id,
    fullName: typedAgent?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
    email: typedAgent?.email || user.email || null,
  });

  return (
    <OnboardingClient
      agentFirstName={firstName(typedAgent?.full_name || user.user_metadata?.full_name || user.user_metadata?.name)}
      intakePath={`/intake/${slug}`}
    />
  );
}
