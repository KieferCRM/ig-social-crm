import Link from "next/link";
import { redirect } from "next/navigation";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import { tagsFromSourceDetail } from "@/lib/tags";
import AddContactPanel from "./add-contact-panel";
import ContactsList from "./contacts-list";

export const dynamic = "force-dynamic";

type ContactRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  time_last_updated: string | null;
  source_detail: Record<string, unknown> | null;
};

type DealSummary = {
  id: string;
  lead_id: string | null;
  stage: string | null;
  property_address: string | null;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showAddForm = params.add === "true";
  const highlightContactId = typeof params.contact === "string" ? params.contact : undefined;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [{ data: contactData }, { data: dealData }, { data: agentRow }] = await Promise.all([
    supabase
      .from("leads")
      .select("id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,stage,lead_temp,source,intent,timeline,time_last_updated,source_detail")
      .eq("agent_id", user.id)
      .order("time_last_updated", { ascending: false })
      .limit(400),
    supabase
      .from("deals")
      .select("id,lead_id,stage,property_address")
      .eq("agent_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("agents").select("settings").eq("id", user.id).maybeSingle(),
  ]);

  const rawContacts = (contactData || []) as ContactRow[];
  const deals = (dealData || []) as DealSummary[];
  const isOffMarketAccount = readOnboardingStateFromAgentSettings(agentRow?.settings || null).account_type === "off_market_agent";

  // Attach tags to each contact
  const contacts = rawContacts.map((c) => ({
    ...c,
    tags: tagsFromSourceDetail(c.source_detail),
  }));

  const withDeals = contacts.filter((c) => deals.some((d) => d.lead_id === c.id)).length;

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Contacts</p>
            <h1 className="crm-page-title">
              {isOffMarketAccount ? "Contacts tied to live deals" : "Your contact list"}
            </h1>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/contacts?add=true" className="crm-btn crm-btn-primary">
              + Add contact
            </Link>
            <Link href={isOffMarketAccount ? "/app/pipeline" : "/app/intake"} className="crm-btn crm-btn-secondary">
              {isOffMarketAccount ? "Pipeline" : "Add from intake"}
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="crm-chip">Total: {contacts.length}</span>
          <span className="crm-chip crm-chip-ok">With deals: {withDeals}</span>
        </div>

        {showAddForm ? <AddContactPanel /> : null}
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <ContactsList
          contacts={contacts}
          deals={deals}
          isOffMarketAccount={isOffMarketAccount}
          highlightId={highlightContactId}
        />
      </section>
    </main>
  );
}
