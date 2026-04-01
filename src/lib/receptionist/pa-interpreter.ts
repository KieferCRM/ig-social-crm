/**
 * PA Interpreter — uses Claude to read a lead's inbound SMS reply and decide
 * what action to take on their behalf.
 *
 * Returns a structured interpretation:
 *   - intent: what the lead is communicating
 *   - suggestedAction: what the CRM should do
 *   - draftReply: what the PA should say back
 */

import Anthropic from "@anthropic-ai/sdk";

export type PaIntent =
  | "interested"       // Lead wants to move forward
  | "schedule_call"    // Lead wants to set up a call/meeting
  | "not_interested"   // Lead wants to opt out / dead deal
  | "question"         // Lead is asking something specific
  | "info_provided"    // Lead gave useful info (timeline, price, etc.)
  | "reschedule"       // Lead wants to push back a follow-up
  | "stop"             // Explicit stop/unsubscribe
  | "unknown";         // Can't determine

export type PaSuggestedActionType =
  | "set_followup_date"
  | "move_stage_dead"
  | "move_stage_negotiating"
  | "move_stage_offer_sent"
  | "no_crm_action"
  | "create_appointment_request";

export type PaSuggestedAction = {
  type: PaSuggestedActionType;
  followup_date?: string;      // YYYY-MM-DD, only for set_followup_date
  notes?: string;              // what to add to deal notes
};

export type PaInterpretation = {
  intent: PaIntent;
  confidence: "high" | "medium" | "low";
  suggestedAction: PaSuggestedAction;
  draftReply: string;
  reasoning: string;          // short explanation for the agent
};

type LeadContext = {
  leadName: string | null;
  propertyAddress: string | null;
  dealStage: string | null;
};

export async function interpretLeadReply(input: {
  messageBody: string;
  agentName: string;
  lead: LeadContext;
  todayStr: string;            // YYYY-MM-DD
}): Promise<PaInterpretation | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const leadName = input.lead.leadName ?? "the lead";
  const address = input.lead.propertyAddress ?? "the property";
  const stage = input.lead.dealStage ?? "prospecting";
  const today = input.todayStr;

  const systemPrompt = `You are the PA for a real estate agent named ${input.agentName}. You interpret inbound SMS replies from leads and decide what action to take.

Lead context:
- Name: ${leadName}
- Property: ${address}
- Deal stage: ${stage}
- Today's date: ${today}

Your job is to return a JSON object with:
- "intent": one of: interested, schedule_call, not_interested, question, info_provided, reschedule, stop, unknown
- "confidence": one of: high, medium, low
- "suggestedAction": object with:
  - "type": one of: set_followup_date, move_stage_dead, move_stage_negotiating, move_stage_offer_sent, no_crm_action, create_appointment_request
  - "followup_date": YYYY-MM-DD string if type is set_followup_date (parse relative dates like "next Tuesday" or "in 2 weeks" from today ${today})
  - "notes": brief note to add to the deal (optional)
- "draftReply": a short, natural SMS reply the PA should send (under 160 chars, friendly, from the agent's perspective, first person as the agent)
- "reasoning": one sentence explaining your interpretation for the agent

Rules:
- If lead says stop/unsubscribe/don't text: intent=stop, action=no_crm_action, no draft reply
- If lead says not interested / no thanks / remove me: intent=not_interested, action=move_stage_dead
- If lead says call me / let's talk / yes / interested: intent=interested or schedule_call
- If lead gives a specific date/time: intent=schedule_call, action=set_followup_date with that date
- If lead asks a question: intent=question, draft a helpful answer, action=no_crm_action
- Keep draft replies short, warm, and conversational — not robotic
- Never invent information about the property that wasn't given
- Return ONLY valid JSON, no markdown`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Lead replied: "${input.messageBody}"`,
        },
      ],
      system: systemPrompt,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!text) return null;

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as PaInterpretation;

    // Basic validation
    if (!parsed.intent || !parsed.suggestedAction || !parsed.draftReply) return null;

    return parsed;
  } catch {
    return null;
  }
}
