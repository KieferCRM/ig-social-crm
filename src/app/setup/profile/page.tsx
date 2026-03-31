import { redirect } from "next/navigation";
import { getOnboardingGuardRedirectPath, readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import ProfileClient from "./profile-client";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, settings")
    .eq("id", user.id)
    .maybeSingle();

  const settings = (agent?.settings ?? {}) as Record<string, unknown>;
  const onboardingState = readOnboardingStateFromAgentSettings(settings);
  const guardRedirect = getOnboardingGuardRedirectPath(onboardingState, "profile");
  if (guardRedirect) redirect(guardRedirect);

  return (
    <ProfileClient
      initialFullName={(agent?.full_name as string | null) ?? ""}
      initialBrokerage={(settings.brokerage as string | null) ?? ""}
      initialPhone={(settings.business_phone_number as string | null) ?? ""}
    />
  );
}
