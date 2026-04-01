import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import {
  getOnboardingGuardRedirectPath,
  readOnboardingStateFromAgentSettings,
} from "@/lib/onboarding";
import SocialClient from "./social-client";

export default async function SocialSetupPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const settings = (agent?.settings ?? {}) as Record<string, unknown>;
  const onboarding = readOnboardingStateFromAgentSettings(settings);
  const guardRedirect = getOnboardingGuardRedirectPath(onboarding, "social");
  if (guardRedirect) redirect(guardRedirect);
  const handles = (settings.social_handles ?? {}) as Record<string, string>;

  return (
    <SocialClient
      initialInstagram={handles.instagram ?? ""}
      initialFacebook={handles.facebook ?? ""}
      initialLinkedin={handles.linkedin ?? ""}
      initialYoutube={handles.youtube ?? ""}
      initialWebsite={handles.website ?? ""}
    />
  );
}
