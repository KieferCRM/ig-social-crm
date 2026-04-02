/**
 * Motivation Scorer — uses Claude to re-score a lead after step 2 enrichment.
 *
 * Reads the full lead from Supabase, analyzes all available signals including
 * free-text motivation, and updates lead_temp + custom_fields.ai_qualification.
 *
 * Called as a background job via Next.js after() so the user never waits.
 */

import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyAgentHotLead } from "@/lib/receptionist/service";

export type MotivationScore = {
  temperature: "Hot" | "Warm" | "Cold";
  score: number; // 1-10
  urgency_reason: string; // one sentence — what drove the score
  agent_note: string; // 2-3 sentences for the agent before they call
  flags: string[]; // e.g. ["needs to sell first", "not decision maker alone", "financing unclear"]
};

export async function scoreLeadWithClaude(leadId: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const admin = supabaseAdmin();

  const { data: lead, error } = await admin
    .from("leads")
    .select(
      "id, agent_id, full_name, canonical_phone, intent, timeline, budget_range, location_area, notes, financing_status, agency_status, lead_temp, custom_fields"
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) return;

  const customFields = (lead.custom_fields as Record<string, unknown>) || {};

  // Build the context block Claude will analyze
  const context: Record<string, string> = {};

  if (lead.full_name) context["Name"] = String(lead.full_name);
  if (lead.intent) context["Intent"] = String(lead.intent);
  if (lead.timeline) context["Timeline"] = String(lead.timeline);
  if (lead.budget_range) context["Budget range"] = String(lead.budget_range);
  if (lead.location_area) context["Location / area"] = String(lead.location_area);
  if (lead.financing_status) context["Pre-approved"] = String(lead.financing_status);
  if (lead.agency_status) context["Working with another agent"] = String(lead.agency_status);
  if (lead.notes) context["Why they're moving / motivation"] = String(lead.notes);

  // Pull step 2 enrichment fields out of custom_fields
  const step2Fields: Array<[string, string]> = [
    ["property_address", "Property address"],
    ["property_type", "Property type"],
    ["asking_price", "Asking price"],
    ["financing_status", "Financing status"],
    ["decision_makers", "Others involved in decision"],
    ["contact_preference", "Preferred contact method"],
    ["referral_source", "How they heard about agent"],
    ["motivation", "Motivation (why moving)"],
    ["blocker", "Constraints or blockers"],
  ];

  for (const [key, label] of step2Fields) {
    const val = customFields[key];
    if (val && typeof val === "string" && val.trim()) {
      context[label] = val.trim();
    }
  }

  if (Object.keys(context).length < 3) {
    // Not enough data to meaningfully score — skip
    return;
  }

  const contextBlock = Object.entries(context)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a real estate assistant helping an agent quickly assess a new lead before their first call.

Your job is to analyze everything known about this lead and return a qualification score.

Return ONLY a valid JSON object with these fields:
- "temperature": "Hot", "Warm", or "Cold"
  - Hot: ready to act within 30 days, clear motivation, finances in order, specific about what they want
  - Warm: interested but 1-6 months out, some motivation, some clarity on finances
  - Cold: vague, no timeline, just browsing, motivation unclear or weak
- "score": integer 1-10 (10 = drop everything and call right now)
- "urgency_reason": one sentence explaining the most important signal that drove this score
- "agent_note": 2-3 sentences the agent should read before calling. Be direct and specific — mention the motivation, any blockers, and what to lead with on the call.
- "flags": array of short strings for anything the agent should know upfront. Examples: "needs to sell first", "not sole decision maker", "pre-approval pending", "price expectation may be off market", "relocation deadline", "financing unclear". Empty array if none.

Rules:
- The motivation text ("Why they're moving") is the most important signal. Weight it heavily.
- If motivation is strong (job change, divorce, lease ending, growing family, inherited property) → lean Hot or Warm
- If motivation is weak or missing ("just looking", "curious", blank) → lean Cold regardless of timeline
- If they said they are already working with another agent → flag it and reduce score significantly
- If they need to sell before buying → flag it, it's a blocker
- Be honest. If signals conflict (says ASAP but motivation is weak), call it out in agent_note
- Return ONLY valid JSON. No markdown.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Lead data:\n${contextBlock}`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!text) return;

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const result = JSON.parse(cleaned) as MotivationScore;

    if (!result.temperature || !result.score || !result.agent_note) return;

    const existingCustom = (lead.custom_fields as Record<string, unknown>) || {};

    await admin
      .from("leads")
      .update({
        lead_temp: result.temperature,
        time_last_updated: new Date().toISOString(),
        custom_fields: {
          ...existingCustom,
          ai_qualification: {
            temperature: result.temperature,
            score: result.score,
            urgency_reason: result.urgency_reason,
            agent_note: result.agent_note,
            flags: result.flags || [],
            scored_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", leadId);

    // Notify agent immediately if Hot
    if (result.temperature === "Hot" && lead.agent_id) {
      await notifyAgentHotLead(admin, lead.agent_id, {
        leadId,
        leadName: lead.full_name as string | null,
        phone: lead.canonical_phone as string | null,
        score: result.score,
        urgencyReason: result.urgency_reason,
        agentNote: result.agent_note,
        flags: result.flags || [],
      });
    }
  } catch {
    // Scoring is best-effort — never throw
  }
}
