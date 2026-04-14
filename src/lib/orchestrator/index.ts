// src/lib/orchestrator/index.ts
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildContextMessage } from "./prompt";
import type { OrchestratorContext, OrchestratorDecision } from "./types";

const client = new Anthropic();

function fallbackDecision(reason: string): OrchestratorDecision {
  return {
    task_action: "create",
    task_reason: `Fallback — orchestrator unavailable: ${reason}`,
    deal_action: "none",
    task: {
      type: "follow_up",
      title: "Follow up with lead",
      reason: "System fallback task",
      description: "Check in with this lead. The AI orchestrator was unavailable when this lead came in.",
      due_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      priority_bucket: "Upcoming",
      context_snapshot: { fallback: true, reason },
    },
  };
}

function parseDecision(text: string): OrchestratorDecision {
  // Strip any markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned) as OrchestratorDecision;

  // Minimal validation — ensure required top-level fields exist
  if (!parsed.task_action || !parsed.deal_action || !parsed.task_reason) {
    throw new Error("Parsed decision missing required fields");
  }

  return parsed;
}

export async function runChiefOrchestrator(
  context: OrchestratorContext
): Promise<OrchestratorDecision> {
  try {
    const systemPrompt = buildSystemPrompt(context.path);
    const userMessage = buildContextMessage(context);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in response");
    }

    return parseDecision(textBlock.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chief-orchestrator] failed, using fallback", { error: message });
    return fallbackDecision(message);
  }
}
