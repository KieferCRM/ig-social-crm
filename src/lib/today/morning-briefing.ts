/**
 * Morning Briefing — uses Claude to generate a concise daily ops briefing
 * for off-market agents based on their live pipeline and activity data.
 */

import Anthropic from "@anthropic-ai/sdk";

export type BriefingInput = {
  todayStr: string;
  activeDeals: Array<{
    propertyAddress: string | null;
    stage: string;
    updatedAt: string | null;
    nextFollowupDate: string | null;
    leadName: string | null;
    leadPhone: string | null;
  }>;
  followupsDue: Array<{
    propertyAddress: string | null;
    leadName: string | null;
    nextFollowupDate: string | null;
    stage: string;
  }>;
  staleDeals: Array<{
    propertyAddress: string | null;
    leadName: string | null;
    updatedAt: string | null;
    stage: string;
  }>;
  todayAppointments: Array<{
    title: string;
    scheduledAt: string;
    location: string | null;
    leadName: string | null;
  }>;
  secretaryDrafts: number;
  tasksDueToday: Array<{ title: string; priority: string }>;
  newLeadsOvernight: number;
};

export type MorningBriefing = {
  text: string;
  generatedAt: string;
};

export async function generateMorningBriefing(
  input: BriefingInput
): Promise<MorningBriefing | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const dataBlock = JSON.stringify(input, null, 2);

  const prompt = `You are the personal operations assistant for a real estate acquisitions agent.
Write a short, direct morning briefing based on today's pipeline data.

Rules:
- 3–5 sentences max. No headers, no bullet points, no markdown. Plain prose only.
- Lead with the most urgent item (appointments first, then overdue follow-ups, then stale deals).
- Name specific people/properties where available — never say "a deal" if you know the address or name.
- If everything is clear, say so confidently. Don't fabricate urgency.
- Tone: sharp, professional, like a trusted assistant who knows the business.
- Do not start with "Good morning" or any greeting.

Today's data:
${dataBlock}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : null;

    if (!text) return null;

    return {
      text,
      generatedAt: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  } catch {
    return null;
  }
}
