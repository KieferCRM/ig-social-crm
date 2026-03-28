export const DEAL_STAGE_VALUES = [
  // shared / traditional general
  "new",
  "showing",
  "offer_made",
  "under_contract",
  "inspection",
  "appraisal",
  "closing",
  "closed",
  "lost",
  "past_client",
  // buyer-specific
  "contacted",
  "qualified",
  "buyer_consultation",
  "active_search",
  // listing-specific
  "listing_appointment",
  "agreement_signed",
  "active_listing",
  // off-market stages
  "prospecting",
  "offer_sent",
  "negotiating",
  "dead",
] as const;

// Legacy combined board (kept for off-market compat)
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

// Buyer pipeline stages
export const BUYER_PIPELINE_STAGES = [
  "new",
  "contacted",
  "qualified",
  "buyer_consultation",
  "active_search",
  "showing",
  "offer_made",
  "under_contract",
  "closed",
  "past_client",
] as const;

// Listing/seller pipeline stages
export const LISTING_PIPELINE_STAGES = [
  "new",
  "listing_appointment",
  "agreement_signed",
  "active_listing",
  "under_contract",
  "closed",
  "past_client",
] as const;

export type BuyerPipelineStage = (typeof BUYER_PIPELINE_STAGES)[number];
export type ListingPipelineStage = (typeof LISTING_PIPELINE_STAGES)[number];

export function getPipelineStages(dealType: "buyer" | "listing" | "all"): readonly string[] {
  if (dealType === "buyer") return BUYER_PIPELINE_STAGES;
  if (dealType === "listing") return LISTING_PIPELINE_STAGES;
  return DEAL_BOARD_STAGES;
}

export function getDefaultStageForType(_dealType: "buyer" | "listing"): DealStage {
  return "new";
}

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
  lead_temp?: string | null;
  source?: string | null;
  intent?: string | null;
  timeline?: string | null;
  location_area?: string | null;
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
  deal_details: Record<string, unknown> | null;
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
  past_client: "Past Client",
  contacted: "Contacted",
  qualified: "Qualified",
  buyer_consultation: "Buyer Consultation",
  active_search: "Active Search",
  listing_appointment: "Listing Appointment",
  agreement_signed: "Agreement Signed",
  active_listing: "Active Listing",
  prospecting: "Prospecting",
  offer_sent: "Offer Sent",
  negotiating: "Negotiating",
  dead: "Dead",
};

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  buyer: "Buyer",
  listing: "Seller",
};

const DEAL_STAGE_TONES: Record<
  DealStage,
  "stage-new" | "stage-qualified" | "stage-active" | "stage-contract" | "stage-closed" | "stage-lost"
> = {
  new: "stage-new",
  contacted: "stage-new",
  qualified: "stage-qualified",
  buyer_consultation: "stage-qualified",
  active_search: "stage-active",
  showing: "stage-active",
  listing_appointment: "stage-new",
  agreement_signed: "stage-qualified",
  active_listing: "stage-active",
  offer_made: "stage-qualified",
  under_contract: "stage-contract",
  inspection: "stage-contract",
  appraisal: "stage-contract",
  closing: "stage-contract",
  closed: "stage-closed",
  past_client: "stage-closed",
  lost: "stage-lost",
  prospecting: "stage-new",
  offer_sent: "stage-qualified",
  negotiating: "stage-active",
  dead: "stage-lost",
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

export function dealStageTone(
  stage: DealStage
): "stage-new" | "stage-qualified" | "stage-active" | "stage-contract" | "stage-closed" | "stage-lost" {
  return DEAL_STAGE_TONES[stage];
}

export function leadTempTone(
  value: string | null | undefined
): "lead-hot" | "lead-warm" | "lead-cold" | "default" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "hot") return "lead-hot";
  if (normalized === "warm") return "lead-warm";
  if (normalized === "cold") return "lead-cold";
  // "Unclassified" and anything else renders neutral so agent knows to set it manually
  return "default";
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
