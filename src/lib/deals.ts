export const DEAL_STAGE_VALUES = [
  "new",
  "showing",
  "offer_made",
  "under_contract",
  "inspection",
  "appraisal",
  "closing",
  "closed",
  "lost",
] as const;

export const DEAL_BOARD_STAGES = [
  "new",
  "showing",
  "offer_made",
  "under_contract",
  "inspection",
  "appraisal",
  "closing",
  "closed",
] as const;

export const DEAL_TYPE_VALUES = ["buyer", "listing"] as const;

export type DealStage = (typeof DEAL_STAGE_VALUES)[number];
export type DealBoardStage = (typeof DEAL_BOARD_STAGES)[number];
export type DealType = (typeof DEAL_TYPE_VALUES)[number];

export type DealLeadSummary = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
};

export type DealRow = {
  id: string;
  agent_id: string;
  lead_id: string;
  property_address: string | null;
  deal_type: DealType;
  price: number | string | null;
  stage: DealStage;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DealWithLead = DealRow & {
  lead: DealLeadSummary | null;
};

const STAGE_LABELS: Record<DealStage, string> = {
  new: "New",
  showing: "Showing",
  offer_made: "Offer Made",
  under_contract: "Under Contract",
  inspection: "Inspection",
  appraisal: "Appraisal",
  closing: "Closing",
  closed: "Closed",
  lost: "Lost",
};

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  buyer: "Buyer",
  listing: "Listing",
};

export function normalizeDealStage(value: string | null | undefined): DealStage {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if ((DEAL_STAGE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DealStage;
  }
  return "new";
}

export function normalizeDealType(value: string | null | undefined): DealType {
  const normalized = String(value || "").trim().toLowerCase();
  if ((DEAL_TYPE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DealType;
  }
  return "buyer";
}

export function dealStageLabel(stage: DealStage): string {
  return STAGE_LABELS[stage];
}

export function dealTypeLabel(type: DealType): string {
  return DEAL_TYPE_LABELS[type];
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function leadDisplayName(lead: DealLeadSummary | null): string {
  if (!lead) return "Unknown lead";
  const full = firstNonEmpty(lead.full_name);
  if (full) return full;
  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const email = firstNonEmpty(lead.canonical_email);
  if (email) return email;
  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) return phone;
  if (lead.ig_username) return `@${lead.ig_username}`;
  return "Unnamed lead";
}
