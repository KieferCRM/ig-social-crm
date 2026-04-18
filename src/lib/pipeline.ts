type StatusBadgeTone =
  | "default"
  | "ok"
  | "warn"
  | "danger"
  | "stage-new"
  | "stage-qualified"
  | "stage-active"
  | "stage-contract"
  | "stage-closed"
  | "stage-lost";

export const OFF_MARKET_STAGES = [
  "prospecting",
  "negotiating",
  "offer_sent",
  "under_contract",
  "dispo_active",
  "buyer_under_contract",
  "assigned",
  "closed",
  "fell_through",
  "dead",
] as const;

export type OffMarketStage = (typeof OFF_MARKET_STAGES)[number];

export const ACQISITION_STAGES: OffMarketStage[] = [
  "prospecting",
  "negotiating",
  "offer_sent",
  "under_contract",
];

export const DISPO_STAGES: OffMarketStage[] = [
  "under_contract",
  "dispo_active",
  "buyer_under_contract",
  "assigned",
  "closed",
  "fell_through",
];

export const PIPELINE_TAGS = [
  "Motivated Seller",
  "Hot Lead",
  "Price Reduction",
  "Off Market",
] as const;

export type PipelineTag = (typeof PIPELINE_TAGS)[number];

const STAGE_LABELS: Record<OffMarketStage, string> = {
  prospecting: "Prospecting",
  offer_sent: "Offer Out",
  negotiating: "Negotiating",
  under_contract: "Under Contract",
  dispo_active: "Dispo Active",
  buyer_under_contract: "Buyer Under Contract",
  assigned: "Assigned",
  closed: "Closed",
  fell_through: "Fell Through",
  dead: "Dead",
};

const STAGE_TONES: Record<OffMarketStage, StatusBadgeTone> = {
  prospecting: "stage-new",
  offer_sent: "stage-qualified",
  negotiating: "stage-active",
  under_contract: "stage-contract",
  dispo_active: "stage-active",
  buyer_under_contract: "stage-contract",
  assigned: "stage-qualified",
  closed: "stage-closed",
  fell_through: "stage-lost",
  dead: "stage-lost",
};

export function normalizeOffMarketStage(value: string | null | undefined): OffMarketStage {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if ((OFF_MARKET_STAGES as readonly string[]).includes(normalized)) {
    return normalized as OffMarketStage;
  }
  return "prospecting";
}

export function offMarketStageLabel(stage: OffMarketStage): string {
  return STAGE_LABELS[stage];
}

export function offMarketStageTone(stage: OffMarketStage): StatusBadgeTone {
  return STAGE_TONES[stage];
}

export function pipelineStageTone(stageValue: string): StatusBadgeTone {
  const normalized = normalizeOffMarketStage(stageValue);
  return STAGE_TONES[normalized];
}

export function pipelineStageLabel(stageValue: string): string {
  const normalized = normalizeOffMarketStage(stageValue);
  return STAGE_LABELS[normalized];
}
