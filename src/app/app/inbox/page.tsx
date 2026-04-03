import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import InboxClient from "./inbox-client";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  full_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
};

type DealRow = {
  id: string;
  property_address: string | null;
  stage: string | null;
  next_followup_date: string | null;
  expected_close_date: string | null;
  updated_at: string | null;
  deal_type: string | null;
  lead?: { full_name?: string | null } | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export default async function InboxPage() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return <div className="crm-page"><p>Not signed in.</p></div>;

  const userId = auth.context.user.id;

  const [{ data: agentRow }, { data: leadData }, { data: dealData }] = await Promise.all([
    supabase.from("agents").select("vanity_slug, settings").eq("id", userId).maybeSingle(),
    supabase
      .from("leads")
      .select("id,full_name,canonical_email,canonical_phone,ig_username")
      .eq("agent_id", userId)
      .order("time_last_updated", { ascending: false })
      .limit(80),
    supabase
      .from("deals")
      .select("id,property_address,stage,next_followup_date,expected_close_date,updated_at,deal_type,lead:leads(full_name)")
      .eq("agent_id", userId)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const vanitySlug = (agentRow?.vanity_slug as string | null) ?? null;
  const inboxEmail = vanitySlug ? `${vanitySlug}@drop.lockboxhq.com` : null;

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const isOffMarketAccount = onboardingState.account_type === "off_market_agent";

  const leads = ((leadData || []) as LeadRow[]).map((lead) => ({
    id: lead.id,
    label:
      firstNonEmpty(lead.full_name, lead.canonical_email, lead.canonical_phone) ||
      (lead.ig_username ? `@${lead.ig_username}` : "Unnamed contact"),
  }));

  const dealsRaw = (dealData || []) as DealRow[];

  const deals = dealsRaw.map((deal) => ({
    id: deal.id,
    label: firstNonEmpty(deal.property_address) || "Untitled deal",
  }));

  const activeTransactions = dealsRaw
    .filter((d) => d.stage === "under_contract" || d.stage === "active" || d.stage === "pending")
    .map((deal) => ({
      id: deal.id,
      address: firstNonEmpty(deal.property_address) || "Untitled deal",
      stage: deal.stage ?? "unknown",
      deal_type: deal.deal_type ?? "unknown",
      client_name: (deal.lead as { full_name?: string | null } | null)?.full_name ?? null,
      next_followup_date: deal.next_followup_date ?? null,
      expected_close_date: deal.expected_close_date ?? null,
      updated_at: deal.updated_at ?? null,
    }));

  return (
    <InboxClient
      agentId={userId}
      inboxEmail={inboxEmail}
      isOffMarketAccount={isOffMarketAccount}
      deals={deals}
      leads={leads}
      activeTransactions={activeTransactions}
    />
  );
}
