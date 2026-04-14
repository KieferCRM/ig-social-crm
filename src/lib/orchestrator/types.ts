// src/lib/orchestrator/types.ts

import type { OperatorPath } from "@/lib/workspace-settings";
export type { OperatorPath };

export type PreferredChannel = "call" | "text" | "email" | null;

export type TaskType =
  | "call"
  | "text"
  | "email"
  | "follow_up"
  | "prepare_cma"
  | "send_listings"
  | "book_consultation"
  | "lender_referral"
  | "document_review"
  | "status_update";

export type PriorityBucket = "Do Now" | "At Risk" | "Upcoming";

export type TaskAction = "create" | "update" | "replace" | "none";

export type DealAction = "create" | "none";

export type OrchestratorContext = {
  lead: {
    id: string;
    full_name: string | null;
    stage: string | null;
    source: string | null;
    created_at: string;
  };
  event: {
    type: string;
    channel: string | null;
    message_text: string | null;
  };
  contact: {
    has_phone: boolean;
    has_email: boolean;
    preferred_channel: PreferredChannel;
  };
  intent: {
    intent_type: string | null;
    timeline_window: string | null;
    location_interest: string | null;
    budget_min: number | null;
    budget_max: number | null;
    property_address: string | null;
  };
  path: OperatorPath;
  open_tasks: Array<{
    title: string;
    urgency: string | null;
    created_at: string;
  }>;
};

export type OrchestratorTask = {
  type: TaskType;
  title: string;
  reason: string;
  description: string;
  due_at: string | null;
  priority_bucket: PriorityBucket;
  context_snapshot: Record<string, unknown>;
};

export type OrchestratorDeal = {
  type: "buyer" | "seller" | "wholesale" | "listing" | "acquisition" | "unknown";
  title: string;
  stage: "new" | "qualified" | "active";
  motivation: string | null;
  timeline: string | null;
};

export type OrchestratorDecision = {
  task_action: TaskAction;
  task_reason: string;
  target_task_id?: string;
  closed_reason?: "replaced_by_newer_task" | "no_longer_relevant" | "duplicate";
  task?: OrchestratorTask;
  deal_action: DealAction;
  deal?: OrchestratorDeal;
  contact_updates?: {
    contact_type?: "buyer" | "seller" | "investor" | "unknown";
    motivation?: string;
  };
};
