import { buildSystemPrompt, buildContextMessage } from "../prompt";
import type { OrchestratorContext } from "../types";

const baseContext: OrchestratorContext = {
  lead: { id: "lead-1", full_name: "John Doe", stage: "New", source: "form", created_at: "2026-04-14T10:00:00Z" },
  event: { type: "form_submission", channel: "website", message_text: "I want to sell my house ASAP" },
  contact: { has_phone: true, has_email: false, preferred_channel: null },
  intent: { intent_type: "seller", timeline_window: "ASAP", location_interest: null, budget_min: null, budget_max: null, property_address: "123 Main St" },
  path: "real_estate",
  open_tasks: [],
};

describe("buildSystemPrompt", () => {
  it("includes real_estate path rules when path is real_estate", () => {
    const prompt = buildSystemPrompt("real_estate");
    expect(prompt).toContain("real_estate");
    expect(prompt).toContain("LPMAMA");
    expect(prompt).toContain("never drop");
  });

  it("includes wholesaler path rules when path is wholesaler", () => {
    const prompt = buildSystemPrompt("wholesaler");
    expect(prompt).toContain("wholesaler");
    expect(prompt).toContain("motivation gate");
    expect(prompt).toContain("MPTP");
  });

  it("includes OrchestratorDecision JSON schema", () => {
    const prompt = buildSystemPrompt("real_estate");
    expect(prompt).toContain("task_action");
    expect(prompt).toContain("priority_bucket");
  });
});

describe("buildContextMessage", () => {
  it("includes lead id in message", () => {
    const msg = buildContextMessage(baseContext);
    expect(msg).toContain("lead-1");
  });

  it("includes intent type", () => {
    const msg = buildContextMessage(baseContext);
    expect(msg).toContain("seller");
  });

  it("includes open tasks when present", () => {
    const ctxWithTasks = {
      ...baseContext,
      open_tasks: [{ title: "Call John", urgency: "urgent", created_at: "2026-04-14T09:00:00Z" }],
    };
    const msg = buildContextMessage(ctxWithTasks);
    expect(msg).toContain("Call John");
  });

  it("notes preferred channel when set", () => {
    const ctxWithPref = { ...baseContext, contact: { ...baseContext.contact, preferred_channel: "text" as const } };
    const msg = buildContextMessage(ctxWithPref);
    expect(msg).toContain("text");
  });
});
