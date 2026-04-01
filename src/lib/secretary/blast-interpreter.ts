/**
 * Blast Interpreter — uses Claude to parse a natural language group text command.
 *
 * e.g. "Text all cash buyers tomorrow at 9am about the Elm St deal"
 * → { tag: "cash buyer", message: "...", scheduled_at: "2026-03-24T09:00:00" }
 */

import Anthropic from "@anthropic-ai/sdk";

export type BlastInterpretation = {
  tag: string;                  // matched tag from available tags
  message: string;              // SMS message to send (≤160 chars)
  scheduled_at: string | null;  // ISO 8601 or null for immediate
  recipient_summary: string;    // e.g. "All cash buyers"
  confirmation: string;         // human-readable summary of what will happen
};

export async function interpretBlastCommand(input: {
  command: string;
  agentName: string;
  availableTags: string[];
  recentDeals: Array<{ address: string; stage: string }>;
  nowIso: string;             // current datetime ISO for relative time parsing
  timezone: string;
}): Promise<BlastInterpretation | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const tagsStr = input.availableTags.length > 0
    ? input.availableTags.join(", ")
    : "(no tags set up yet)";

  const dealsStr = input.recentDeals.length > 0
    ? input.recentDeals.map((d) => `${d.address} (${d.stage})`).join("; ")
    : "(no active deals)";

  const system = `You are the Secretary AI for a real estate agent named ${input.agentName}.
The agent just gave you a group text command in plain English. Parse it and return a JSON object.

Available contact tags: ${tagsStr}
Active deals: ${dealsStr}
Current time: ${input.nowIso}
Agent timezone: ${input.timezone}

Return ONLY valid JSON with these fields:
{
  "tag": "the exact tag to text (must be one of the available tags, or the closest match)",
  "message": "the SMS message to send — keep under 160 characters, friendly and natural, from the agent's perspective",
  "scheduled_at": "ISO 8601 datetime string if a future time was mentioned, or null for immediate send",
  "recipient_summary": "plain english who will be texted, e.g. 'All cash buyers'",
  "confirmation": "one sentence describing exactly what will happen, e.g. 'I\\'ll text all 8 cash buyers tomorrow at 9am: [message preview]'"
}

Rules:
- If the command mentions a specific deal or property, reference it in the message naturally
- If no time is mentioned, scheduled_at = null (send immediately)
- Parse relative times like "tomorrow at 9am", "Monday", "in 2 hours" relative to current time
- Keep the message conversational, not robotic — this is a real estate agent texting their contacts
- If no tag matches closely, use the closest available tag
- Return ONLY valid JSON, no markdown`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: `Command: "${input.command}"` }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!text) return null;

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as BlastInterpretation;

    if (!parsed.tag || !parsed.message || !parsed.confirmation) return null;
    return parsed;
  } catch {
    return null;
  }
}
