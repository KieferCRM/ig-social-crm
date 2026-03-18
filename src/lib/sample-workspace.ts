import { buildSyntheticLeadHandle } from "@/lib/leads/identity";
import { normalizeLeadSourceChannel } from "@/lib/inbound";
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
        },
        custom_fields: {
          sample_workspace: true,
          sample_workspace_label: label,
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

export async function seedSampleWorkspaceForAgent(admin: AdminClient, agentId: string) {
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
  });

  const dealRows = [
    {
      agent_id: agentId,
      lead_id: hotLead.id,
      property_address: "[Sample] East Nashville buyer search",
      deal_type: "buyer",
      price: 625000,
      stage: "showing",
      notes: "Sample deal created to show an active buyer opportunity.",
    },
    {
      agent_id: agentId,
      lead_id: warmLead.id,
      property_address: "[Sample] Green Hills listing prep",
      deal_type: "listing",
      price: 995000,
      stage: "new",
      notes: "Sample deal created to show a seller opportunity entering the board.",
    },
  ];

  const { error: dealError } = await admin.from("deals").insert(dealRows);
  if (dealError) {
    throw new Error(dealError.message);
  }

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
    .upsert(recommendationRows, { onConflict: "owner_user_id,lead_id,title" });
  if (recommendationError) {
    throw new Error(recommendationError.message);
  }
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
