import Link from "next/link";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import AddContactPanel from "./add-contact-panel";
import ContactTagsEditor from "./contact-tags-editor";
import { tagsFromSourceDetail } from "@/lib/tags";

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

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function contactName(contact: ContactRow): string {
  const combined = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return (
    firstNonEmpty(contact.full_name) ||
    firstNonEmpty(combined) ||
    firstNonEmpty(contact.canonical_email) ||
    firstNonEmpty(contact.canonical_phone) ||
    (contact.ig_username ? `@${contact.ig_username.replace(/^@+/, "")}` : "Unnamed contact")
  );
}

function formatLastTouch(value: string | null): string {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showAddForm = params.add === "true";
  const selectedDealId = typeof params.dealId === "string" ? params.dealId : "";
  const searchQuery = typeof params.q === "string" ? params.q.trim() : "";
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  let contactQuery = supabase
    .from("leads")
    .select(
      "id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,stage,lead_temp,source,intent,timeline,time_last_updated,source_detail"
    )
    .eq("agent_id", user.id)
    .order("time_last_updated", { ascending: false })
    .limit(200);

  if (searchQuery) {
    contactQuery = contactQuery.or(
      `full_name.ilike.%${searchQuery}%,canonical_phone.ilike.%${searchQuery}%,canonical_email.ilike.%${searchQuery}%`
    );
  }

  const [{ data: contactData }, { data: dealData }, { data: agentRow }] = await Promise.all([
    contactQuery,
    supabase
      .from("deals")
      .select("id,lead_id,stage,property_address")
      .eq("agent_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("agents").select("settings").eq("id", user.id).maybeSingle(),
  ]);

  const contacts = (contactData || []) as ContactRow[];
  const deals = (dealData || []) as DealSummary[];
  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const isOffMarketAccount = onboardingState.account_type === "off_market_agent";

  const dealsByLead = new Map<string, DealSummary[]>();
  for (const deal of deals) {
    if (!deal.lead_id) continue;
    const current = dealsByLead.get(deal.lead_id) || [];
    current.push(deal);
    dealsByLead.set(deal.lead_id, current);
  }

  const tagFrequency = new Map<string, number>();
  for (const contact of contacts) {
    for (const tag of tagsFromSourceDetail(contact.source_detail)) {
      tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
    }
  }
  const topTags = Array.from(tagFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const visibleContacts = selectedDealId
    ? contacts.filter((contact) => (dealsByLead.get(contact.id) || []).some((deal) => deal.id === selectedDealId))
    : contacts;

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Contacts</p>
            <h1 className="crm-page-title">
              {isOffMarketAccount ? "Contacts tied to live deals" : "Tag-driven contact list"}
            </h1>
            <p className="crm-page-subtitle">
              {isOffMarketAccount
                ? "Keep sellers, buyers, and transaction relationships tied to the right deal so context is usable when several opportunities are moving."
                : "Keep buyers, sellers, and future outreach groups organized without losing the linked deal context."}
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/contacts?add=true" className="crm-btn crm-btn-primary">
              Add contact
            </Link>
            <Link href={isOffMarketAccount ? "/app/deals" : "/app/intake"} className="crm-btn crm-btn-secondary">
              {isOffMarketAccount ? "Open deals" : "Add from intake"}
            </Link>
          </div>
        </div>

        {showAddForm ? <AddContactPanel /> : null}

        <form method="GET" action="/app/contacts" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by name, phone, or email…"
            className="crm-input"
            style={{ maxWidth: 300, fontSize: 13 }}
            autoComplete="off"
          />
          <button type="submit" className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>Search</button>
          {searchQuery ? (
            <a href="/app/contacts" className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>Clear</a>
          ) : null}
        </form>

        <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="crm-chip">Contacts: {contacts.length}</span>
          <span className="crm-chip crm-chip-ok">
            With active deals: {contacts.filter((contact) => (dealsByLead.get(contact.id) || []).length > 0).length}
          </span>
          <span className="crm-chip crm-chip-info">
            {isOffMarketAccount ? "Tagged relationships" : "Tracked tags"}: {topTags.length}
          </span>
          {selectedDealId ? <span className="crm-chip crm-chip-warn">Filtered to one deal</span> : null}
        </div>
      </section>

      <section className="crm-grid-cards-3">
        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">{isOffMarketAccount ? "Transaction tags" : "Top tags"}</h2>
          </div>
          <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
            {topTags.length === 0 ? (
              <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>Tags will appear as intake and deals accumulate.</span>
            ) : (
              topTags.map(([tag, count]) => (
                <span key={tag} className="crm-chip">
                  {tag} · {count}
                </span>
              ))
            )}
          </div>
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">{isOffMarketAccount ? "Deal relationships" : "Outreach grouping"}</h2>
          </div>
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            {isOffMarketAccount
              ? "Use contacts to keep seller, buyer, and supporting relationships attached to the active opportunity instead of scattered across messages and files."
              : "Use tags to group buyer lists, seller follow-up, acquisition prospects, and future blasts without overbuilding a campaign system."}
          </p>
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Daily use</h2>
          </div>
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            {isOffMarketAccount
              ? "Deals stay central, but this page keeps the people attached to each transaction easy to review and update."
              : "Contacts stay secondary to deals, but this page makes buyer and seller segmentation usable for outreach and follow-up planning."}
          </p>
        </article>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Contacts</h2>
        </div>

        <div className="crm-stack-8">
          {visibleContacts.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              {selectedDealId
                ? "No contacts are linked to that deal yet."
                : "No contacts yet. Buyer and seller intake, manual entry, and Concierge capture will populate this list automatically."}
            </div>
          ) : null}

          {visibleContacts.map((contact) => {
            const tags = tagsFromSourceDetail(contact.source_detail);
            const linkedDeals = dealsByLead.get(contact.id) || [];

            return (
              <article key={contact.id} className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div className="crm-stack-4">
                    <div style={{ fontWeight: 700 }}>{contactName(contact)}</div>
                    <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                      {firstNonEmpty(contact.canonical_phone, contact.canonical_email) || "No direct contact yet"}
                    </div>
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                    {contact.source ? (
                      <StatusBadge label={sourceChannelLabel(contact.source)} tone={sourceChannelTone(contact.source)} />
                    ) : null}
                    {contact.lead_temp ? (
                      <StatusBadge
                        label={contact.lead_temp}
                        tone={
                          contact.lead_temp === "Hot"
                            ? "lead-hot"
                            : contact.lead_temp === "Warm"
                              ? "lead-warm"
                              : "lead-cold"
                        }
                      />
                    ) : null}
                    {contact.intent ? <StatusBadge label={contact.intent} tone="default" /> : null}
                  </div>
                </div>

                <div className="crm-detail-grid">
                  <div>
                    <div className="crm-detail-label">Timeline</div>
                    <div>{contact.timeline || "Not provided"}</div>
                  </div>
                  <div>
                    <div className="crm-detail-label">Linked deals</div>
                    <div>{linkedDeals.length}</div>
                  </div>
                  <div>
                    <div className="crm-detail-label">Lead stage</div>
                    <div>{contact.stage || "New"}</div>
                  </div>
                  <div>
                    <div className="crm-detail-label">Last touch</div>
                    <div>{formatLastTouch(contact.time_last_updated)}</div>
                  </div>
                </div>

                {linkedDeals.length > 0 ? (
                  <div className="crm-stack-4">
                    <div className="crm-detail-label">Deal links</div>
                    <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                      {linkedDeals.slice(0, 3).map((deal) => (
                        <Link key={deal.id} href="/app/pipeline" className="crm-chip">
                          {deal.property_address || "Untitled deal"}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="crm-stack-4">
                  <div className="crm-detail-label">Tags</div>
                  <ContactTagsEditor
                    contactId={contact.id}
                    initialTags={tags}
                    isOffMarketAccount={isOffMarketAccount}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
