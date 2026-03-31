import { redirect } from "next/navigation";
import {
  getOnboardingGuardRedirectPath,
  readOnboardingStateFromAgentSettings,
} from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import AccountTypeClient from "./account-type-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountTypeSetupPage({ searchParams }: PageProps) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);

  const guardRedirect = getOnboardingGuardRedirectPath(onboardingState, "account_type");
  if (guardRedirect) {
    redirect(guardRedirect);
  }

  const [{ data: leadRow }, { data: dealRow }] = await Promise.all([
    supabase.from("leads").select("id").eq("agent_id", user.id).limit(1).maybeSingle(),
    supabase.from("deals").select("id").eq("agent_id", user.id).limit(1).maybeSingle(),
  ]);

  if (leadRow?.id || dealRow?.id) {
    redirect("/app");
  }

  const params = (await searchParams) || {};
  const trackParam = Array.isArray(params.track) ? params.track[0] : params.track;
  const recommendedType =
    trackParam === "off_market_agent" ? "off_market_agent" : "solo_agent";

  return <AccountTypeClient recommendedType={recommendedType} />;
}
