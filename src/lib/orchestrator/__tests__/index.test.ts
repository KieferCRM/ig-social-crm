import { runChiefOrchestrator } from "../index";
import type { OrchestratorContext } from "../types";
import Anthropic from "@anthropic-ai/sdk";

jest.mock("@anthropic-ai/sdk");

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

const baseContext: OrchestratorContext = {
  lead: { id: "lead-1", full_name: "Jane Smith", stage: "New", source: "form", created_at: "2026-04-14T10:00:00Z" },
  event: { type: "form_submission", channel: "website", message_text: "I want to buy a house" },
  contact: { has_phone: true, has_email: true, preferred_channel: null },
  intent: { intent_type: "buyer", timeline_window: "30_days", location_interest: "Austin", budget_min: 400000, budget_max: 600000, property_address: null },
  path: "real_estate",
  open_tasks: [],
};

const validDecision = {
  task_action: "create",
  task_reason: "New buyer lead with 30-day timeline. Speed-to-lead is critical.",
  task: {
    type: "call",
    title: "Call Jane Smith — new buyer inquiry",
    reason: "First contact within 2 hours",
    description: "Call Jane and use LPMAMA to qualify.",
    due_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    priority_bucket: "Do Now",
    context_snapshot: { intent: "buyer", timeline: "30_days" },
  },
  deal_action: "create",
  deal: {
    type: "buyer",
    title: "Jane Smith — Buyer",
    stage: "new",
    motivation: null,
    timeline: "30_days",
  },
};

describe("runChiefOrchestrator", () => {
  beforeEach(() => {
    MockedAnthropic.mockClear();
  });

  it("returns a parsed OrchestratorDecision on success", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validDecision) }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    const result = await runChiefOrchestrator(baseContext);

    expect(result.task_action).toBe("create");
    expect(result.task?.type).toBe("call");
    expect(result.task?.priority_bucket).toBe("Do Now");
    expect(result.deal_action).toBe("create");
  });

  it("passes path-correct system prompt to Claude", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validDecision) }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    await runChiefOrchestrator(baseContext);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain("real_estate");
    expect(callArgs.model).toBe("claude-sonnet-4-6");
  });

  it("returns a safe fallback task when Claude API throws", async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error("API timeout"));
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    const result = await runChiefOrchestrator(baseContext);

    expect(result.task_action).toBe("create");
    expect(result.task?.type).toBe("follow_up");
    expect(result.task?.priority_bucket).toBe("Upcoming");
    expect(result.deal_action).toBe("none");
  });

  it("returns a safe fallback task when Claude returns malformed JSON", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "Here is my analysis: { broken json" }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    const result = await runChiefOrchestrator(baseContext);

    expect(result.task_action).toBe("create");
    expect(result.task?.type).toBe("follow_up");
  });

  it("uses wholesaler path system prompt when context.path is wholesaler", async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ ...validDecision, task_action: "none", task_reason: "no motivation signals", deal_action: "none" }) }],
    });
    MockedAnthropic.prototype.messages = { create: mockCreate } as never;

    await runChiefOrchestrator({ ...baseContext, path: "wholesaler" });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain("wholesaler");
    expect(callArgs.system).toContain("motivation gate");
  });
});
