import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import DealsBoardClient from "./deals-board-client";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const onboarding = readOnboardingStateFromAgentSettings(agent?.settings);
  if (onboarding.account_type === "off_market_agent") redirect("/app/pipeline");

  return <DealsBoardClient />;
}
