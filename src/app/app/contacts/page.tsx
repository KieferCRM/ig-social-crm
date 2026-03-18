import Link from "next/link";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { PREVIEW_DEALS, PREVIEW_LEADS } from "@/lib/preview-data";
import { isPreviewModeServer } from "@/lib/preview-mode";
import { supabaseServer } from "@/lib/supabase/server";
import { formatTagsText, tagsFromSourceDetail } from "@/lib/tags";

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

export default async function ContactsPage() {
  const preview = await isPreviewModeServer();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !preview) {
    redirect("/auth");
  }

  let contacts: ContactRow[] = [];
  let deals: DealSummary[] = [];

  if (preview && !user) {
    contacts = [...PREVIEW_LEADS] as unknown as ContactRow[];
    deals = [...PREVIEW_DEALS].map((deal) => ({
      id: deal.id,
      lead_id: deal.lead_id,
      stage: deal.stage,
    }));
  } else if (user) {
    const [{ data: contactData }, { data: dealData }] = await Promise.all([
      supabase
        .from("leads")
        .select(
          "id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,stage,lead_temp,source,intent,timeline,time_last_updated,source_detail"
        )
        .eq("agent_id", user.id)
        .order("time_last_updated", { ascending: false })
        .limit(60),
      supabase
        .from("deals")
        .select("id,lead_id,stage")
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    contacts = (contactData || []) as ContactRow[];
    deals = (dealData || []) as DealSummary[];
  }
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

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Contacts</p>
            <h1 className="crm-page-title">Tag-driven contact list</h1>
            <p className="crm-page-subtitle">
              Keep buyers, sellers, and future outreach groups organized without losing the linked
              deal context.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/intake" className="crm-btn crm-btn-secondary">
              Add from intake
            </Link>
            <Link href="/app/social" className="crm-btn crm-btn-primary">
              Open social workflow
            </Link>
          </div>
        </div>

        <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="crm-chip">Contacts: {contacts.length}</span>
          <span className="crm-chip crm-chip-ok">
            With active deals: {contacts.filter((contact) => (dealsByLead.get(contact.id) || []).length > 0).length}
          </span>
          <span className="crm-chip crm-chip-info">Tracked tags: {topTags.length}</span>
        </div>
      </section>

      <section className="crm-grid-cards-3">
        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Top tags</h2>
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
            <h2 className="crm-section-title">Outreach grouping</h2>
          </div>
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            Use tags to group buyer lists, seller follow-up, acquisition prospects, and future
            blasts without overbuilding a campaign system.
          </p>
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Daily use</h2>
          </div>
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            Contacts stay secondary to deals, but this page makes buyer and seller segmentation
            usable for outreach and follow-up planning.
          </p>
        </article>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Contacts</h2>
        </div>

        <div className="crm-stack-8">
          {contacts.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              No contacts yet. Buyer and seller intake, manual entry, and Concierge capture will
              populate this list automatically.
            </div>
          ) : null}

          {contacts.map((contact) => {
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
                      <StatusBadge
                        label={sourceChannelLabel(contact.source)}
                        tone={sourceChannelTone(contact.source)}
                      />
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

                <div className="crm-stack-4">
                  <div className="crm-detail-label">Tags</div>
                  {tags.length > 0 ? (
                    <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                      {tags.map((tag) => (
                        <span key={`${contact.id}-${tag}`} className="crm-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{formatTagsText(tags) || "No tags yet"}</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
