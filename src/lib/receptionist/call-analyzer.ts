/**
 * Call Analyzer — uses Claude to analyze a post-call transcript and extract
 * structured lead data + urgency scoring.
 *
 * Called from the ElevenLabs post-call webhook after each inbound call.
 */

import Anthropic from "@anthropic-ai/sdk";

export type CallUrgency = "hot" | "warm" | "cold";

export type CallAnalysis = {
  intent: string | null;          // buy / sell / buy and sell / inquiring about listing / other
  urgency: CallUrgency;           // hot / warm / cold
  property_area: string | null;   // address or area mentioned
  timeline: string | null;        // timeframe mentioned
  budget: string | null;          // price range mentioned
  action_items: string | null;    // what the agent should do next
  summary: string;                // 1-2 sentence plain English summary
};

export async function analyzeCallTranscript(input: {
  transcript: string;
  agentName: string;
}): Promise<CallAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are analyzing a phone call transcript from a real estate office. The agent's assistant answered on behalf of ${input.agentName}.

Extract what you can from the conversation and return a JSON object with:
- "intent": what the caller wants — one of: "buy", "sell", "buy and sell", "inquiring about listing", "existing client", "other". Null if unclear.
- "urgency": how urgent this lead is — one of: "hot", "warm", "cold"
  - hot: ready to act now or within 30 days, distressed situation, very specific request, calling about a specific listing
  - warm: interested but not urgent, 1-6 month timeframe, exploring options
  - cold: just curious, no timeline, vague inquiry
- "property_area": any specific address, neighborhood, or area mentioned. Null if none.
- "timeline": any timeframe the caller mentioned. Null if none.
- "budget": any price range or budget mentioned. Null if none.
- "action_items": what ${input.agentName} should do on the callback. Null if nothing specific.
- "summary": 1-2 sentences summarizing who called and why, written for the agent to read before calling back.

Rules:
- Base urgency on the caller's actual words and tone, not assumptions
- If they called about a specific listing or property, that's at least warm
- If they said they need to sell fast or are in a distressed situation, that's hot
- Keep the summary factual and brief — agent will read this before calling back
- Return ONLY valid JSON, no markdown`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Transcript:\n${input.transcript}`,
        },
      ],
      system: systemPrompt,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!text) return null;

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as CallAnalysis;

    if (!parsed.urgency || !parsed.summary) return null;

    return parsed;
  } catch {
    return null;
  }
}
