import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import {
  getOnboardingGuardRedirectPath,
  readOnboardingStateFromAgentSettings,
} from "@/lib/onboarding";
import SlugClient from "./slug-client";

export default async function SlugSetupPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings, vanity_slug, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const onboarding = readOnboardingStateFromAgentSettings(agentRow?.settings ?? null);
  const guardRedirect = getOnboardingGuardRedirectPath(onboarding, "slug");
  if (guardRedirect) redirect(guardRedirect);

  // Already has a slug — skip
  if (agentRow?.vanity_slug) redirect("/app");

  // Derive a suggested slug from their name or email
  const fullName = (agentRow?.full_name as string | null) ?? null;
  const email = user.email ?? null;

  function slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  const suggestedSlug =
    (fullName && slugify(fullName)) ||
    (email && slugify(email.split("@")[0] ?? "")) ||
    "";

  return <SlugClient suggestedSlug={suggestedSlug} />;
}
