import { OFF_MARKET_STAGES, offMarketStageLabel, type OffMarketStage } from "@/lib/pipeline";

export type PipelineStageConfig = {
  value: OffMarketStage;
  label: string;
};

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = OFF_MARKET_STAGES.map((v) => ({
  value: v,
  label: offMarketStageLabel(v),
}));

export function readPipelineStages(
  agentSettings: Record<string, unknown> | null
): PipelineStageConfig[] {
  const raw = agentSettings?.pipeline_stages as PipelineStageConfig[] | undefined;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_PIPELINE_STAGES;
  // Ensure all default stages exist (in case new stages are added later)
  const seen = new Set(raw.map((s) => s.value));
  const merged = [...raw];
  for (const def of DEFAULT_PIPELINE_STAGES) {
    if (!seen.has(def.value)) merged.push(def);
  }
  return merged;
}
