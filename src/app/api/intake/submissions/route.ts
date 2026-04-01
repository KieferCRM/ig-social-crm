import { NextResponse } from "next/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { normalizeSourceChannel, sourceChannelLabel } from "@/lib/inbound";
import { supabaseServer } from "@/lib/supabase/server";

type SubmissionLeadRow = {
  id: string;
  full_name: string | null;
  ig_username: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  intent: string | null;
  timeline: string | null;
  lead_temp: string | null;
  stage: string | null;
  source: string | null;
  location_area: string | null;
  budget_range: string | null;
  notes: string | null;
  time_last_updated: string | null;
  updated_at: string | null;
  created_at: string | null;
  source_detail: Record<string, unknown> | null;
};

type DealRow = {
  id: string;
  lead_id: string | null;
  stage: string | null;
  property_address: string | null;
  updated_at: string | null;
};

type RecommendationRow = {
  id: string;
  lead_id: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  due_at: string | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function leadDisplayName(row: SubmissionLeadRow): string {
  const full = firstNonEmpty(row.full_name);
  if (full) return full;
  const handle = firstNonEmpty(row.ig_username);
  if (handle) return `@${handle.replace(/^@+/, "")}`;
  const email = firstNonEmpty(row.canonical_email);
  if (email) return email;
  const phone = firstNonEmpty(row.canonical_phone);
  if (phone) return phone;
  return "Unnamed inquiry";
}

function isInboundSource(value: string | null | undefined): boolean {
  return normalizeSourceChannel(value) !== null;
}

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,full_name,ig_username,canonical_email,canonical_phone,intent,timeline,lead_temp,stage,source,location_area,budget_range,notes,time_last_updated,updated_at,created_at,source_detail"
    )
    .or(ownerFilter(auth.context, "agent_id"))
    .order("time_last_updated", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: "Could not load inbound submissions." }, { status: 500 });
  }

  const leads = ((data || []) as SubmissionLeadRow[])
    .filter((row) => row.id)
    .filter((row) => isInboundSource(row.source));

  const leadIds = leads.map((lead) => lead.id);
  let dealsByLead = new Map<string, DealRow>();
  let recommendationsByLead = new Map<string, RecommendationRow>();

  if (leadIds.length > 0) {
    const { data: dealsData } = await supabase
      .from("deals")
      .select("id,lead_id,stage,property_address,updated_at")
      .in("lead_id", leadIds)
      .order("updated_at", { ascending: false });

    dealsByLead = new Map(
      ((dealsData || []) as DealRow[])
        .filter((row) => row.lead_id)
        .map((row) => [String(row.lead_id), row])
    );

    const { data: recommendationData } = await supabase
      .from("lead_recommendations")
      .select("id,lead_id,title,description,priority,due_at")
      .eq("status", "open")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    recommendationsByLead = new Map(
      ((recommendationData || []) as RecommendationRow[])
        .filter((row) => row.lead_id)
        .map((row) => [String(row.lead_id), row])
    );
  }

  const submissions = leads.slice(0, 24).map((lead) => {
    const sourceDetail = asObject(lead.source_detail);
    const deal = dealsByLead.get(lead.id) || null;
    const recommendation = recommendationsByLead.get(lead.id) || null;
    const propertyContext = firstNonEmpty(
      typeof sourceDetail?.property_context === "string" ? sourceDetail.property_context : null,
      deal?.property_address || null,
      lead.location_area
    );

    return {
      id: lead.id,
      lead_name: leadDisplayName(lead),
      source: sourceChannelLabel(lead.source),
      is_sample_workspace: Boolean(sourceDetail?.sample_workspace),
      intent: firstNonEmpty(lead.intent) || "Not specified",
      timeline: firstNonEmpty(lead.timeline) || "Not specified",
      temperature: firstNonEmpty(lead.lead_temp) || "Warm",
      stage: firstNonEmpty(lead.stage) || "New",
      property_context: propertyContext || "New inbound inquiry",
      budget_range: firstNonEmpty(lead.budget_range) || null,
      deal_id: deal?.id || null,
      deal_stage: firstNonEmpty(deal?.stage) || null,
      next_action: firstNonEmpty(recommendation?.title) || null,
      next_action_detail: firstNonEmpty(recommendation?.description) || null,
      next_action_priority: firstNonEmpty(recommendation?.priority) || null,
      next_action_due_at: recommendation?.due_at || null,
      timestamp: lead.time_last_updated || lead.updated_at || lead.created_at || null,
    };
  });

  return NextResponse.json({ submissions });
}
