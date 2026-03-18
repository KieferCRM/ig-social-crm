import Link from "next/link";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { supabaseServer } from "@/lib/supabase/server";
import { tagsFromSourceDetail } from "@/lib/tags";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  full_name: string | null;
  canonical_phone: string | null;
  canonical_email: string | null;
  ig_username: string | null;
  source: string | null;
  lead_temp: string | null;
  time_last_updated: string | null;
  source_detail: Record<string, unknown> | null;
};

type RecommendationRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  due_at: string | null;
  metadata: Record<string, unknown> | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function isSocialSource(value: string | null | undefined): boolean {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("instagram") || normalized.includes("facebook") || normalized.includes("tiktok");
}

function formatDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default async function SocialPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const recommendationOwnerFilter = `owner_user_id.eq.${user.id},agent_id.eq.${user.id}`;

  const [{ data: agentRow }, { data: leadData }, { data: recommendationData }] = await Promise.all([
    supabase.from("agents").select("settings").eq("id", user.id).maybeSingle(),
    supabase
      .from("leads")
      .select("id,full_name,canonical_phone,canonical_email,ig_username,source,lead_temp,time_last_updated,source_detail")
      .eq("agent_id", user.id)
      .order("time_last_updated", { ascending: false })
      .limit(40),
    supabase
      .from("lead_recommendations")
      .select("id,title,description,priority,due_at,metadata")
      .or(recommendationOwnerFilter)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const settings = readWorkspaceSettingsFromAgentSettings(agentRow?.settings || null);
  const socialLeads = ((leadData || []) as LeadRow[]).filter((lead) => isSocialSource(lead.source));
  const socialRecommendations = ((recommendationData || []) as RecommendationRow[]).filter((item) => {
    const source = typeof item.metadata?.source_channel === "string" ? item.metadata.source_channel : "";
    return isSocialSource(source);
  });

  const responseBuckets = {
    noResponse: socialLeads.filter((lead) => String(lead.lead_temp || "").toLowerCase() === "cold").length,
    responded: socialLeads.filter((lead) => String(lead.lead_temp || "").toLowerCase() === "warm").length,
    followUp: socialRecommendations.length,
    interestedBuyer: socialLeads.filter((lead) => tagsFromSourceDetail(lead.source_detail).includes("buyer")).length,
  };

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Social Media</p>
            <h1 className="crm-page-title">Outreach planning without the noise</h1>
            <p className="crm-page-subtitle">
              Keep quick platform jumps, saved scripts, and social follow-up visible in one place
              without turning the CRM into a scheduler.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/intake" className="crm-btn crm-btn-secondary">
              Open intake
            </Link>
            <Link href="/app/contacts" className="crm-btn crm-btn-primary">
              View tagged contacts
            </Link>
          </div>
        </div>
      </section>

      <section className="crm-grid-cards-3">
        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Platform shortcuts</h2>
          </div>
          <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
            {settings.instagram_url ? (
              <a href={settings.instagram_url} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                Instagram
              </a>
            ) : null}
            {settings.facebook_url ? (
              <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                Facebook
              </a>
            ) : null}
            {settings.tiktok_url ? (
              <a href={settings.tiktok_url} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                TikTok
              </a>
            ) : null}
            {!settings.instagram_url && !settings.facebook_url && !settings.tiktok_url ? (
              <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                Add your platform URLs in Settings to keep one-click jumps here.
              </span>
            ) : null}
          </div>
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Response buckets</h2>
          </div>
          <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="crm-chip">No response · {responseBuckets.noResponse}</span>
            <span className="crm-chip crm-chip-warn">Needs follow-up · {responseBuckets.followUp}</span>
            <span className="crm-chip crm-chip-ok">Interested buyers · {responseBuckets.interestedBuyer}</span>
            <span className="crm-chip crm-chip-info">Responded · {responseBuckets.responded}</span>
          </div>
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">How this helps daily</h2>
          </div>
          <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14 }}>
            Use this page for scripts, follow-up reminders, and quick platform jumps while keeping
            actual messaging and posting inside the native social apps.
          </p>
        </article>
      </section>

      <section className="crm-grid-cards-2">
        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Outreach queue</h2>
          </div>
          {socialRecommendations.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              No social follow-up items right now.
            </div>
          ) : null}
          {socialRecommendations.map((item) => {
            const source = typeof item.metadata?.source_channel === "string" ? item.metadata.source_channel : null;
            return (
              <div key={item.id} className="crm-card-muted crm-stack-8" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <StatusBadge label={item.priority || "open"} tone="default" />
                </div>
                {item.description ? <div style={{ color: "var(--ink-muted)" }}>{item.description}</div> : null}
                <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  {source ? (
                    <StatusBadge label={sourceChannelLabel(source)} tone={sourceChannelTone(source)} />
                  ) : null}
                  <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>Due {formatDate(item.due_at)}</span>
                </div>
              </div>
            );
          })}
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Saved scripts</h2>
          </div>
          {settings.saved_scripts.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              Add scripts in Settings to keep them here.
            </div>
          ) : null}
          {settings.saved_scripts.map((script) => (
            <div key={script.id} className="crm-card-muted crm-stack-6" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>{script.title}</div>
                <StatusBadge label={script.category.replace(/_/g, " ")} tone="info" />
              </div>
              <div style={{ color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}>{script.body}</div>
            </div>
          ))}
        </article>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Recent social leads</h2>
        </div>
        <div className="crm-stack-8">
          {socialLeads.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              Social inbound from Instagram, Facebook, and TikTok will appear here automatically.
            </div>
          ) : null}
          {socialLeads.slice(0, 12).map((lead) => (
            <article key={lead.id} className="crm-card-muted crm-stack-8" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="crm-stack-4">
                  <div style={{ fontWeight: 700 }}>
                    {firstNonEmpty(lead.full_name, lead.canonical_phone, lead.canonical_email) ||
                      (lead.ig_username ? `@${lead.ig_username}` : "Social inquiry")}
                  </div>
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    {lead.canonical_phone || lead.canonical_email || "No direct contact saved yet"}
                  </div>
                </div>
                <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  {lead.source ? (
                    <StatusBadge label={sourceChannelLabel(lead.source)} tone={sourceChannelTone(lead.source)} />
                  ) : null}
                  {lead.lead_temp ? (
                    <StatusBadge
                      label={lead.lead_temp}
                      tone={
                        lead.lead_temp === "Hot"
                          ? "lead-hot"
                          : lead.lead_temp === "Warm"
                            ? "lead-warm"
                            : "lead-cold"
                      }
                    />
                  ) : null}
                </div>
              </div>
              <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                {tagsFromSourceDetail(lead.source_detail).map((tag) => (
                  <span key={`${lead.id}-${tag}`} className="crm-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
