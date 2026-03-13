import Link from "next/link";
import { redirect } from "next/navigation";
import { normalizeDealStage, type DealStage } from "@/lib/deals";
import { supabaseServer } from "@/lib/supabase/server";
import DashboardPanel from "./dashboard-panel";
import DashboardRightRail from "./dashboard-right-rail";
export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
};

type RecommendationRow = {
  id: string;
  lead_id: string | null;
  person_id: string | null;
  reason_code: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "done" | "dismissed";
  due_at: string | null;
  created_at: string;
};

type DealLeadRow = {
  id?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  canonical_email?: unknown;
  canonical_phone?: unknown;
  ig_username?: unknown;
} | null;

type DealRow = {
  id?: unknown;
  lead_id?: unknown;
  property_address?: unknown;
  price?: unknown;
  stage?: unknown;
  expected_close_date?: unknown;
  updated_at?: unknown;
  lead?: DealLeadRow | DealLeadRow[];
};

type PriorityDeal = {
  id: string;
  client_name: string;
  property_address: string | null;
  price: number | string | null;
  stage: DealStage;
  expected_close_date: string | null;
  updated_at: string | null;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeLeadValue(
  value: DealLeadRow | DealLeadRow[] | undefined
): Exclude<DealLeadRow, null> | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  return first;
}

function dealClientName(value: DealLeadRow | DealLeadRow[] | undefined): string {
  const lead = normalizeLeadValue(value);
  if (!lead) return "Unknown lead";
  const full = typeof lead.full_name === "string" ? lead.full_name : null;
  if (full && full.trim()) return full.trim();
  const first = typeof lead.first_name === "string" ? lead.first_name : null;
  const last = typeof lead.last_name === "string" ? lead.last_name : null;
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const email = typeof lead.canonical_email === "string" ? lead.canonical_email : null;
  if (email && email.trim()) return email.trim();
  const phone = typeof lead.canonical_phone === "string" ? lead.canonical_phone : null;
  if (phone && phone.trim()) return phone.trim();
  const username = typeof lead.ig_username === "string" ? lead.ig_username : null;
  if (username && username.trim()) return `@${username.trim()}`;
  return "Unnamed lead";
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isCurrentMonth(dateValue: string | null): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function isWithinNextDays(dateValue: string | null, days: number): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue).getTime();
  if (Number.isNaN(date)) return false;
  const now = Date.now();
  const end = now + days * 24 * 3600_000;
  return date >= now && date <= end;
}

function isRecentlyUpdated(dateValue: string | null, days = 7): boolean {
  if (!dateValue) return false;
  const ts = new Date(dateValue).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= Date.now() - days * 24 * 3600_000;
}

function urgencyScore(deal: PriorityDeal): number {
  const now = Date.now();
  const closeTs = deal.expected_close_date ? new Date(deal.expected_close_date).getTime() : Number.POSITIVE_INFINITY;
  const updatedTs = deal.updated_at ? new Date(deal.updated_at).getTime() : 0;
  const underContractBoost = deal.stage === "under_contract" ? 250_000_000_000 : 0;
  const closeBoost = Number.isFinite(closeTs)
    ? Math.max(0, 120_000_000_000 - Math.max(0, closeTs - now))
    : 0;
  const freshnessBoost = Math.max(0, updatedTs - (now - 30 * 24 * 3600_000));
  return underContractBoost + closeBoost + freshnessBoost;
}

export default async function AppHome({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const ownerOnly = `agent_id.eq.${user.id}`;

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, ig_username, full_name, first_name, last_name, canonical_email, canonical_phone, stage, lead_temp, source, intent, timeline, last_message_preview, time_last_updated"
    )
    .or(ownerOnly);

  const { data: dealsData } = await supabase
    .from("deals")
    .select(
      "id,lead_id,property_address,price,stage,expected_close_date,updated_at,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username)"
    )
    .eq("agent_id", user.id)
    .order("updated_at", { ascending: false });

  let recommendations: RecommendationRow[] = [];
  const { data: recommendationData, error: recommendationError } = await supabase
    .from("lead_recommendations")
    .select("id, lead_id, person_id, reason_code, title, description, priority, status, due_at, created_at")
    .or(ownerOnly)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!recommendationError) {
    recommendations = (recommendationData || []) as RecommendationRow[];
  }

  const params = (await searchParams) || {};
  const newLeadId = asSingle(params.new_lead_id) || "";
  const onboardingDone = asSingle(params.onboarding) === "done";

  const leadRows = (leads || []) as LeadRow[];
  if (!error && leadRows.length === 0) {
    redirect("/app/onboarding");
  }

  const hot = leadRows.filter((l) => l.lead_temp === "Hot").length;
  const newCount = leadRows.filter((l) => l.stage === "New").length;
  const sortedLeadRows = leadRows
    .slice()
    .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || ""));
  const dealRows = (Array.isArray(dealsData) ? dealsData : []) as DealRow[];
  const mappedDeals = dealRows
    .map((deal): PriorityDeal | null => {
      const id = asString(deal.id);
      if (!id) return null;
      return {
        id,
        client_name: dealClientName(deal.lead),
        property_address: asIso(deal.property_address),
        price:
          typeof deal.price === "number" || typeof deal.price === "string"
            ? deal.price
            : null,
        stage: normalizeDealStage(typeof deal.stage === "string" ? deal.stage : null),
        expected_close_date: asIso(deal.expected_close_date),
        updated_at: asIso(deal.updated_at),
      };
    })
    .filter((deal): deal is PriorityDeal => Boolean(deal));
  const activeDealsList = mappedDeals.filter((deal) => deal.stage !== "closed" && deal.stage !== "lost");
  const activeDeals = activeDealsList.length;
  const underContract = activeDealsList.filter((deal) => deal.stage === "under_contract").length;
  const closingThisMonth = activeDealsList.filter((deal) => isCurrentMonth(deal.expected_close_date)).length;
  const urgentDeals = activeDealsList
    .filter(
      (deal) =>
        deal.stage === "under_contract" ||
        isWithinNextDays(deal.expected_close_date, 30) ||
        isRecentlyUpdated(deal.updated_at, 7)
    )
    .sort((a, b) => urgencyScore(b) - urgencyScore(a));
  const priorityDeals = (urgentDeals.length > 0 ? urgentDeals : activeDealsList)
    .slice()
    .sort((a, b) => urgencyScore(b) - urgencyScore(a))
    .slice(0, 3);
  const newLead = newLeadId
    ? sortedLeadRows.find((lead) => lead.id === newLeadId) || null
    : null;
  const newLeadName =
    firstNonEmpty(
      newLead?.full_name,
      `${newLead?.first_name || ""} ${newLead?.last_name || ""}`.trim(),
      newLead?.canonical_email,
      newLead?.canonical_phone
    ) || "Test Buyer";

  return (
    <main className="crm-dashboard-page crm-stack-12">
      {onboardingDone ? (
        <section className="crm-card crm-section-card">
          <div className="crm-inline-actions" style={{ justifyContent: "space-between", width: "100%" }}>
            <div>
              <div style={{ fontWeight: 700 }}>You&apos;re ready.</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>
                Leads that submit your form will appear here.
              </div>
            </div>
            {newLead ? (
              <Link href={`/app/leads/${newLead.id}`} className="crm-btn crm-btn-secondary">
                Open {newLeadName}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <DashboardPanel
        hot={hot}
        newCount={newCount}
        activeDeals={activeDeals}
        underContract={underContract}
        closingThisMonth={closingThisMonth}
        allLeads={sortedLeadRows}
        recommendations={recommendations}
        rightRail={
          <DashboardRightRail
            leads={sortedLeadRows}
            activeDeals={activeDeals}
            underContract={underContract}
            closingThisMonth={closingThisMonth}
            priorityDeals={priorityDeals}
          />
        }
      />
    </main>
  );
}
