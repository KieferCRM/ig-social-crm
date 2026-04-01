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
  "closed",
  "dead",
] as const;

export type OffMarketStage = (typeof OFF_MARKET_STAGES)[number];

export const PIPELINE_TAGS = [
  "Motivated Seller",
  "Hot Lead",
  "Price Reduction",
  "Off Market",
] as const;

export type PipelineTag = (typeof PIPELINE_TAGS)[number];

const STAGE_LABELS: Record<OffMarketStage, string> = {
  prospecting: "Prospecting",
  offer_sent: "Offer Sent",
  negotiating: "Negotiating",
  under_contract: "Under Contract",
  closed: "Closed",
  dead: "Dead",
};

const STAGE_TONES: Record<OffMarketStage, StatusBadgeTone> = {
  prospecting: "stage-new",
  offer_sent: "stage-qualified",
  negotiating: "stage-active",
  under_contract: "stage-contract",
  closed: "stage-closed",
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
