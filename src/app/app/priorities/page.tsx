import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import PrioritiesClient from "./priorities-client";

export const dynamic = "force-dynamic";

export default async function PrioritiesPage() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return <div className="crm-page"><p>Not signed in.</p></div>;

  const userId = auth.context.user.id;
  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", userId)
    .maybeSingle();

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const isOffMarketAccount = onboardingState.account_type === "off_market_agent";

  return <PrioritiesClient isOffMarketAccount={isOffMarketAccount} />;
}
