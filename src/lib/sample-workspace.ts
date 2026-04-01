import { buildSyntheticLeadHandle } from "@/lib/leads/identity";
import { normalizeLeadSourceChannel } from "@/lib/inbound";
import type { AccountType } from "@/lib/onboarding";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

type SeedLeadInput = {
  fullName: string;
  email: string;
  phone: string;
  intent: string;
  timeline: "0-3 months" | "3-6 months" | "6+ months";
  source: string;
  locationArea: string;
  budgetRange: string;
  notes: string;
  stage: "New" | "Contacted" | "Qualified";
  leadTemp: "Cold" | "Warm" | "Hot";
  tags?: string[];
  customFields?: Record<string, unknown>;
};

type SeedLeadResult = {
  id: string;
  fullName: string;
  intent: string;
  timeline: string;
  leadTemp: string;
  locationArea: string;
};

function sampleHandle(agentId: string, label: string): string {
  return buildSyntheticLeadHandle("sample_workspace", `${agentId}_${label}`);
}

async function insertLead(
  admin: AdminClient,
  agentId: string,
  label: string,
  input: SeedLeadInput
): Promise<SeedLeadResult> {
  const leadSourceChannel = normalizeLeadSourceChannel(input.source) || "other";
  const { data, error } = await admin
    .from("leads")
    .upsert(
      {
        agent_id: agentId,
        owner_user_id: agentId,
        assignee_user_id: agentId,
        ig_username: sampleHandle(agentId, label),
        full_name: input.fullName,
        canonical_email: input.email,
        raw_email: input.email,
        canonical_phone: input.phone,
        raw_phone: input.phone,
        source: input.source,
        stage: input.stage,
        lead_temp: input.leadTemp,
        intent: input.intent,
        timeline: input.timeline,
        location_area: input.locationArea,
        budget_range: input.budgetRange,
        notes: input.notes,
        contact_preference: "Text",
        time_last_updated: new Date().toISOString(),
        latest_source_method: "manual",
        first_source_method: "manual",
        first_source_channel: leadSourceChannel,
        latest_source_channel: leadSourceChannel,
        source_detail: {
          sample_workspace: true,
          sample_workspace_label: label,
          tags: input.tags || [],
        },
        custom_fields: {
          sample_workspace: true,
          sample_workspace_label: label,
          ...(input.customFields || {}),
        },
      },
      { onConflict: "agent_id,ig_username" }
    )
    .select("id,full_name,intent,timeline,lead_temp,location_area")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Could not seed sample lead.");
  }

  return {
    id: String(data.id),
    fullName: String(data.full_name || input.fullName),
    intent: String(data.intent || input.intent),
    timeline: String(data.timeline || input.timeline),
    leadTemp: String(data.lead_temp || input.leadTemp),
    locationArea: String(data.location_area || input.locationArea),
  };
}

async function seedSoloSampleWorkspaceForAgent(admin: AdminClient, agentId: string) {
  const hotLead = await insertLead(admin, agentId, "hot_buyer", {
    fullName: "[Sample] Mia Parker",
    email: "sample.mia@lockboxhq.test",
    phone: "(615) 555-0101",
    intent: "Buy",
    timeline: "0-3 months",
    source: "instagram",
    locationArea: "East Nashville",
    budgetRange: "$500k-$750k",
    notes:
      "Sample workspace lead. Buyer inquiry with a near-term timeframe so the agent can see a hot inbound example.",
    stage: "Contacted",
    leadTemp: "Hot",
    tags: ["buyer", "instagram", "active buyer"],
  });

  const warmLead = await insertLead(admin, agentId, "warm_seller", {
    fullName: "[Sample] Daniel Brooks",
    email: "sample.daniel@lockboxhq.test",
    phone: "(615) 555-0102",
    intent: "Sell",
    timeline: "3-6 months",
    source: "open_house",
    locationArea: "Green Hills",
    budgetRange: "$900k-$1.1M",
    notes:
      "Sample workspace lead. Seller inquiry with a mid-range timeframe to show a warm follow-up example.",
    stage: "Qualified",
    leadTemp: "Warm",
    tags: ["seller", "open house", "warm follow-up"],
  });

  const coldLead = await insertLead(admin, agentId, "cold_referral", {
    fullName: "[Sample] Chloe Bennett",
    email: "sample.chloe@lockboxhq.test",
    phone: "(615) 555-0103",
    intent: "Invest",
    timeline: "6+ months",
    source: "referral",
    locationArea: "Franklin",
    budgetRange: "$750k-$1M",
    notes:
      "Sample workspace lead. Longer-term investor inquiry so the agent can see a lower-priority cold lead.",
    stage: "New",
    leadTemp: "Cold",
    tags: ["investor", "referral"],
  });

  const now = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const followupSoon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  const dealRows = [
    {
      agent_id: agentId,
      lead_id: hotLead.id,
      property_address: "[Sample] East Nashville buyer search",
      deal_type: "buyer",
      price: 625000,
      stage: "active_search",
      tags: ["Pre-Approved", "First-Time Buyer"],
      stage_entered_at: threeDaysAgo,
      next_followup_date: followupSoon,
      notes: "Sample deal. Buyer is pre-approved at $650k. Looking for 3bd/2ba in East Nashville or Inglewood. No HOA preferred.",
      deal_details: {
        preapproval_status: "pre_approved",
        preapproval_amount: "650000",
        lender_name: "First National Mortgage",
        financing_type: "conventional",
        search_criteria: "3bd/2ba, East Nashville or Inglewood, min 1400sqft, no HOA",
        price_range_min: "450000",
        price_range_max: "650000",
        move_in_timeline: "1_3_months",
        buyer_agreement_signed: "yes",
        referral_source: "Instagram DM",
      },
    },
    {
      agent_id: agentId,
      lead_id: warmLead.id,
      property_address: "[Sample] 4812 Hillsboro Pike, Nashville TN",
      deal_type: "listing",
      price: 995000,
      stage: "active_listing",
      tags: ["Price Reduced"],
      stage_entered_at: tenDaysAgo,
      next_followup_date: followupSoon,
      notes: "Sample deal. Listed 10 days ago. One price reduction already. Two showings scheduled this week.",
      deal_details: {
        original_list_price: "1050000",
        list_price: "995000",
        mls_number: "MLS-2024-8841",
        commission_rate: "3.0",
        listing_expiration_date: new Date(Date.now() + 80 * 86_400_000).toISOString().slice(0, 10),
        seller_motivation: "relocation",
        showing_instructions: "Lockbox on front door. Call 30 min ahead. Dog is secured in backyard.",
        referral_source: "Past client referral",
      },
    },
    {
      agent_id: agentId,
      lead_id: coldLead.id,
      property_address: "[Sample] Franklin buyer search",
      deal_type: "buyer",
      price: 875000,
      stage: "lost",
      tags: ["Referral"],
      stage_entered_at: now,
      notes: "Sample deal showing a lost opportunity. Buyer went with another agent after a slow follow-up.",
      deal_details: {
        preapproval_status: "pre_approved",
        preapproval_amount: "900000",
        financing_type: "conventional",
        search_criteria: "4bd/3ba, Franklin or Brentwood, good schools",
        move_in_timeline: "3_6_months",
        referral_source: "Referral from John Torres",
      },
    },
  ];

  // Non-fatal: sample deals are nice-to-have, don't block onboarding
  await admin.from("deals").insert(dealRows).then(({ error }) => {
    if (error) console.warn("Sample deals insert skipped:", error.message);
  });

  const recommendationRows = [
    {
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: hotLead.id,
      person_id: null,
      source_event_id: null,
      reason_code: "sample_hot_inbound",
      title: "Call [Sample] Mia Parker today",
      description: "Sample priority item: hot inbound from Instagram with a 0-3 month timeframe.",
      priority: "urgent",
      status: "open",
      due_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      metadata: { sample_workspace: true },
    },
    {
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: warmLead.id,
      person_id: null,
      source_event_id: null,
      reason_code: "sample_warm_followup",
      title: "Follow up with [Sample] Daniel Brooks",
      description: "Sample priority item: warm seller lead with a 3-6 month timeframe.",
      priority: "high",
      status: "open",
      due_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
      metadata: { sample_workspace: true },
    },
    {
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: coldLead.id,
      person_id: null,
      source_event_id: null,
      reason_code: "sample_cold_nurture",
      title: "Send a light follow-up to [Sample] Chloe Bennett",
      description: "Sample priority item: longer-term lead that can wait.",
      priority: "medium",
      status: "open",
      due_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      metadata: { sample_workspace: true },
    },
  ];

  const { error: recommendationError } = await admin
    .from("lead_recommendations")
    .insert(recommendationRows);
  if (recommendationError) {
    throw new Error(recommendationError.message);
  }
}

async function seedOffMarketSampleWorkspaceForAgent(admin: AdminClient, agentId: string) {
  const sellerLead = await insertLead(admin, agentId, "off_market_seller", {
    fullName: "[Sample] Marcus Hale",
    email: "sample.marcus@lockboxhq.test",
    phone: "(615) 555-0141",
    intent: "Sell",
    timeline: "0-3 months",
    source: "facebook",
    locationArea: "Wilson County",
    budgetRange: "$380k-$430k",
    notes:
      "Sample off-market seller lead. Property is being analyzed now and the seller wants a quick call about options.",
    stage: "Contacted",
    leadTemp: "Hot",
    tags: ["off-market seller", "motivated seller", "acquisition"],
    customFields: {
      account_type: "off_market_agent",
      workflow_segment: "acquisition",
    },
  });

  const buyerLead = await insertLead(admin, agentId, "off_market_buyer", {
    fullName: "[Sample] Sierra Capital Group",
    email: "sample.sierra@lockboxhq.test",
    phone: "(615) 555-0142",
    intent: "Buy",
    timeline: "0-3 months",
    source: "direct_outreach",
    locationArea: "Nashville investor list",
    budgetRange: "$300k-$600k",
    notes:
      "Sample cash buyer lead. Strong fit for disposition outreach once the property is controlled.",
    stage: "Qualified",
    leadTemp: "Warm",
    tags: ["cash buyer", "buyer blast", "disposition"],
    customFields: {
      account_type: "off_market_agent",
      workflow_segment: "disposition",
    },
  });

  const analysisLead = await insertLead(admin, agentId, "off_market_analysis", {
    fullName: "[Sample] Tori Bennett",
    email: "sample.tori@lockboxhq.test",
    phone: "(615) 555-0143",
    intent: "Sell",
    timeline: "3-6 months",
    source: "referral",
    locationArea: "Murfreesboro",
    budgetRange: "$450k-$520k",
    notes:
      "Sample seller lead that still needs comps and a clearer property conversation before moving forward.",
    stage: "Qualified",
    leadTemp: "Warm",
    tags: ["seller follow-up", "needs comps", "acquisition"],
    customFields: {
      account_type: "off_market_agent",
      workflow_segment: "analysis",
    },
  });

  const dealRows = [
    {
      agent_id: agentId,
      lead_id: sellerLead.id,
      property_address: "[Sample] 214 County Line Rd",
      deal_type: "listing",
      price: 405000,
      stage: "prospecting",
      notes: "Sample off-market deal. Seller agreement is in place and buyer outreach is next.",
    },
    {
      agent_id: agentId,
      lead_id: buyerLead.id,
      property_address: "[Sample] Buyer disposition list",
      deal_type: "buyer",
      price: 405000,
      stage: "prospecting",
      notes: "Sample off-market deal. Cash buyer list is active for disposition follow-up.",
    },
  ];

  // Non-fatal: sample deals are nice-to-have, don't block onboarding
  await admin.from("deals").insert(dealRows).then(({ error }) => {
    if (error) console.warn("Sample deals insert skipped:", error.message);
  });

  const recommendationRows = [
    {
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: sellerLead.id,
      person_id: null,
      source_event_id: null,
      reason_code: "sample_off_market_seller_call",
      title: "Call [Sample] Marcus Hale now",
      description: "Hot seller lead. Confirm motivation, property details, and acquisition next steps.",
      priority: "urgent",
      status: "open",
      due_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      metadata: { sample_workspace: true, account_type: "off_market_agent", workflow_segment: "acquisition" },
    },
    {
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: buyerLead.id,
      person_id: null,
      source_event_id: null,
      reason_code: "sample_off_market_buyer_blast",
      title: "Send buyer blast for 214 County Line Rd",
      description: "Disposition follow-up is ready. Use your tagged cash buyer list first.",
      priority: "high",
      status: "open",
      due_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
      metadata: { sample_workspace: true, account_type: "off_market_agent", workflow_segment: "disposition" },
    },
    {
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: analysisLead.id,
      person_id: null,
      source_event_id: null,
      reason_code: "sample_off_market_analysis",
      title: "Review comps before the next seller call",
      description: "This seller looks viable, but the property analysis still needs tighter pricing context.",
      priority: "medium",
      status: "open",
      due_at: new Date(Date.now() + 8 * 3600_000).toISOString(),
      metadata: { sample_workspace: true, account_type: "off_market_agent", workflow_segment: "analysis" },
    },
  ];

  const { error: recommendationError } = await admin
    .from("lead_recommendations")
    .insert(recommendationRows);
  if (recommendationError) {
    throw new Error(recommendationError.message);
  }
}

export async function seedSampleWorkspaceForAgent(
  admin: AdminClient,
  agentId: string,
  accountType: AccountType = "solo_agent"
) {
  if (accountType === "off_market_agent") {
    await seedOffMarketSampleWorkspaceForAgent(admin, agentId);
    return;
  }

  await seedSoloSampleWorkspaceForAgent(admin, agentId);
}

export async function clearSampleWorkspaceForAgent(admin: AdminClient, agentId: string) {
  const { data: leadRows, error: leadError } = await admin
    .from("leads")
    .select("id")
    .eq("agent_id", agentId)
    .like("ig_username", "sample_workspace_%");

  if (leadError) {
    throw new Error(leadError.message);
  }

  const leadIds = (leadRows || [])
    .map((row) => String(row.id || ""))
    .filter((id) => id.length > 0);

  if (leadIds.length === 0) {
    return { removed: 0 };
  }

  await admin.from("lead_recommendations").delete().in("lead_id", leadIds).eq("owner_user_id", agentId);
  await admin.from("follow_up_reminders").delete().in("lead_id", leadIds);
  await admin.from("deals").delete().in("lead_id", leadIds).eq("agent_id", agentId);
  await admin.from("lead_events").delete().in("lead_id", leadIds).eq("agent_id", agentId);
  const { error: deleteLeadError } = await admin.from("leads").delete().in("id", leadIds).eq("agent_id", agentId);

  if (deleteLeadError) {
    throw new Error(deleteLeadError.message);
  }

  return { removed: leadIds.length };
}
