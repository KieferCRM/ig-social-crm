/**
 * GET /api/leads/[id]/summary
 *
 * Uses Claude to generate a brief agent briefing for a lead —
 * who they are, what they want, what's happened, what to do next.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const admin = supabaseAdmin();

  // Load lead
  const { data: lead, error } = await admin
    .from("leads")
    .select("full_name,canonical_phone,canonical_email,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,lead_temp,urgency_score,stage,created_at,last_communication_at,source_detail,custom_fields")
    .eq("id", id)
    .eq("agent_id", auth.context.user.id)
    .maybeSingle();

  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Load recent interactions
  const { data: interactions } = await admin
    .from("lead_interactions")
    .select("channel,direction,raw_message_body,summary,created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const interactionSummary = (interactions ?? [])
    .map((i) => `[${i.channel} ${i.direction}] ${i.summary || i.raw_message_body || ""}`.trim())
    .filter(Boolean)
    .join("\n");

  const sourceDetail = lead.source_detail && typeof lead.source_detail === "object" && !Array.isArray(lead.source_detail)
    ? (lead.source_detail as Record<string, unknown>)
    : null;
  const customFields = lead.custom_fields && typeof lead.custom_fields === "object" && !Array.isArray(lead.custom_fields)
    ? (lead.custom_fields as Record<string, unknown>)
    : null;
  const buyerProfile =
    (customFields?.buyer_profile && typeof customFields.buyer_profile === "object" && !Array.isArray(customFields.buyer_profile)
      ? (customFields.buyer_profile as Record<string, unknown>)
      : null) ||
    (sourceDetail?.buyer_profile && typeof sourceDetail.buyer_profile === "object" && !Array.isArray(sourceDetail.buyer_profile)
      ? (sourceDetail.buyer_profile as Record<string, unknown>)
      : null);

  const leadContext = [
    lead.full_name ? `Name: ${lead.full_name}` : null,
    lead.canonical_phone ? `Phone: ${lead.canonical_phone}` : null,
    lead.intent ? `Intent: ${lead.intent}` : null,
    lead.timeline ? `Timeline: ${lead.timeline}` : null,
    lead.budget_range ? `Budget: ${lead.budget_range}` : null,
    lead.location_area ? `Area: ${lead.location_area}` : null,
    lead.lead_temp ? `Temperature: ${lead.lead_temp}` : null,
    lead.source ? `Source: ${lead.source}` : null,
    lead.notes ? `Notes: ${lead.notes.slice(0, 500)}` : null,
    buyerProfile ? `Buyer profile: ${JSON.stringify(buyerProfile)}` : null,
    interactionSummary ? `Recent interactions:\n${interactionSummary}` : null,
  ].filter(Boolean).join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a real estate assistant. Write a brief 2-3 sentence briefing for the agent about this lead.
Focus on: who they are, what they want, and the single most important next action.
Be direct and practical — the agent is about to call or meet this person.
Write in second person ("This lead..." or "They..."). No bullet points, just plain sentences.`,
      messages: [
        {
          role: "user",
          content: leadContext,
        },
      ],
    });

    const summary = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!summary) return NextResponse.json({ error: "Could not generate summary" }, { status: 500 });

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
