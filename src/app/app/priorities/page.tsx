import Link from "next/link";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import { dealStageLabel, dealStageTone, normalizeDealStage } from "@/lib/deals";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { PREVIEW_DEALS, PREVIEW_RECOMMENDATIONS } from "@/lib/preview-data";
import { isPreviewModeServer } from "@/lib/preview-mode";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RecommendationRow = {
  id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  metadata?: Record<string, unknown> | null;
};

type DealRow = {
  id: string;
  property_address: string | null;
  stage: string | null;
  updated_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString();
}

function isStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return ts < Date.now() - 5 * 24 * 3600_000;
}

function recommendationTone(priority: RecommendationRow["priority"]): "default" | "warn" | "danger" {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warn";
  return "default";
}

export default async function PrioritiesPage() {
  const preview = await isPreviewModeServer();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !preview) {
    redirect("/auth");
  }

  let recommendations: RecommendationRow[] = [];
  let staleDeals: DealRow[] = [];

  if (preview && !user) {
    recommendations = [...PREVIEW_RECOMMENDATIONS] as unknown as RecommendationRow[];
    staleDeals = ([...PREVIEW_DEALS] as unknown as DealRow[]).filter((deal) => isStale(deal.updated_at)).slice(0, 6);
  } else if (user) {
    const recommendationOwnerFilter = `owner_user_id.eq.${user.id},agent_id.eq.${user.id}`;
    const [{ data: recommendationData }, { data: dealData }] = await Promise.all([
      supabase
        .from("lead_recommendations")
        .select("id,lead_id,title,description,priority,due_at,metadata")
        .or(recommendationOwnerFilter)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(18),
      supabase
        .from("deals")
        .select("id,property_address,stage,updated_at")
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: true })
        .limit(18),
    ]);

    recommendations = (recommendationData || []) as RecommendationRow[];
    staleDeals = ((dealData || []) as DealRow[]).filter((deal) => isStale(deal.updated_at)).slice(0, 6);
  }

  const contactNow = recommendations.filter((item) => item.priority === "urgent" || item.priority === "high");
  const canWait = recommendations.filter((item) => item.priority === "medium" || item.priority === "low");

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Priorities</p>
            <h1 className="crm-page-title">Quiet assistant queue</h1>
            <p className="crm-page-subtitle">
              Calm, useful guidance only. Contact-now work first, then stale deals, then the items that can wait.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/deals" className="crm-btn crm-btn-secondary">
              Open deals
            </Link>
            <Link href="/app/intake" className="crm-btn crm-btn-primary">
              Review intake
            </Link>
          </div>
        </div>
      </section>

      <section className="crm-priorities-grid">
        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Contact Now</h2>
            <span className="crm-chip crm-chip-danger">{contactNow.length}</span>
          </div>
          {contactNow.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              Nothing urgent right now.
            </div>
          ) : null}
          {contactNow.map((item) => {
            const metadata = item.metadata || {};
            const source = typeof metadata.source_channel === "string" ? metadata.source_channel : null;
            const temperature = typeof metadata.temperature === "string" ? metadata.temperature : null;
            return (
              <div key={item.id} className="crm-card-muted crm-ai-panel crm-stack-8" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <StatusBadge label={item.priority === "urgent" ? "Now" : "Today"} tone={recommendationTone(item.priority)} />
                </div>
                {item.description ? <div style={{ color: "var(--ink-muted)" }}>{item.description}</div> : null}
                <div className="crm-inline-actions" style={{ gap: 8 }}>
                  {source ? (
                    <StatusBadge label={sourceChannelLabel(source)} tone={sourceChannelTone(source)} />
                  ) : null}
                  {temperature ? (
                    <StatusBadge
                      label={temperature}
                      tone={
                        temperature === "Hot"
                          ? "lead-hot"
                          : temperature === "Warm"
                            ? "lead-warm"
                            : "lead-cold"
                      }
                    />
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Due {formatDate(item.due_at)}</div>
              </div>
            );
          })}
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Update This Deal</h2>
            <span className="crm-chip crm-chip-warn">{staleDeals.length}</span>
          </div>
          {staleDeals.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              No stale deals right now.
            </div>
          ) : null}
          {staleDeals.map((deal) => (
            <div key={deal.id} className="crm-card-muted crm-stack-8" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>{deal.property_address || "Deal needs context"}</div>
                <StatusBadge label={dealStageLabel(normalizeDealStage(deal.stage))} tone={dealStageTone(normalizeDealStage(deal.stage))} />
              </div>
              <div style={{ color: "var(--ink-muted)" }}>
                No movement on this deal in the last few days. It likely needs a quick update or follow-up.
              </div>
            </div>
          ))}
        </article>

        <article className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Can Wait</h2>
            <span className="crm-chip">{canWait.length}</span>
          </div>
          {canWait.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
              No lower-priority follow-ups at the moment.
            </div>
          ) : null}
          {canWait.map((item) => (
              <div key={item.id} className="crm-card-muted crm-ai-panel crm-stack-8" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>{item.title}</div>
                <StatusBadge label="Later" tone="default" />
              </div>
              {item.description ? <div style={{ color: "var(--ink-muted)" }}>{item.description}</div> : null}
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Due {formatDate(item.due_at)}</div>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
