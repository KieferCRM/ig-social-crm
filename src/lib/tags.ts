import { normalizeSourceChannel, sourceChannelLabel } from "@/lib/inbound";

function pushTag(target: string[], value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return;
  if (!target.includes(normalized)) target.push(normalized);
}

export function inferLeadTags(input: {
  intent?: string | null;
  source?: string | null;
  leadTemp?: string | null;
  timeline?: string | null;
  financingStatus?: string | null;
  preapprovalStatus?: string | null;
  propertyType?: string | null;
  firstTimeBuyer?: string | null;
  buyingReason?: string | null;
  hasPropertyToSell?: string | null;
  agencyStatus?: string | null;
}): string[] {
  const tags: string[] = [];
  const intent = (input.intent || "").trim().toLowerCase();
  const temp = (input.leadTemp || "").trim().toLowerCase();
  const source = normalizeSourceChannel(input.source);
  const financing = (input.financingStatus || "").trim().toLowerCase();
  const preapproval = (input.preapprovalStatus || "").trim().toLowerCase();
  const agency = (input.agencyStatus || "").trim().toLowerCase();

  if (intent === "buy") {
    pushTag(tags, "buyer");
    pushTag(tags, "disposition");
  } else if (intent === "sell") {
    pushTag(tags, "seller");
    pushTag(tags, "acquisition");
  } else if (intent === "invest") {
    pushTag(tags, "investor");
    pushTag(tags, "buyer");
  } else if (intent === "rent") {
    pushTag(tags, "renter");
  }

  if (source) {
    pushTag(tags, sourceChannelLabel(source));
    if (source === "instagram" || source === "facebook" || source === "tiktok") {
      pushTag(tags, "social");
    }
    if (source === "open_house") pushTag(tags, "open house");
    if (source === "referral") pushTag(tags, "referral");
    if (source === "concierge") pushTag(tags, "missed call");
  }

  if (temp === "hot" || temp === "warm" || temp === "cold") {
    pushTag(tags, temp);
  }

  if (financing) {
    if (financing.includes("cash")) {
      pushTag(tags, "cash buyer");
    } else if (financing.includes("mortgage") || financing.includes("financ")) {
      pushTag(tags, "financed buyer");
    }
  }

  if (preapproval.includes("yes") || preapproval.includes("pre-approv") || preapproval.includes("pre approv")) {
    pushTag(tags, "preapproved");
  }

  const propertyType = (input.propertyType || "").trim().toLowerCase();
  if (propertyType) {
    if (propertyType.includes("single")) pushTag(tags, "single family");
    else if (propertyType.includes("condo")) pushTag(tags, "condo");
    else if (propertyType.includes("town")) pushTag(tags, "townhome");
    else if (propertyType.includes("multi")) pushTag(tags, "multi-family");
    else if (propertyType.includes("land")) pushTag(tags, "land");
    else pushTag(tags, propertyType);
  }

  const firstTimeBuyer = (input.firstTimeBuyer || "").trim().toLowerCase();
  if (firstTimeBuyer === "yes") pushTag(tags, "first-time buyer");

  const buyingReason = (input.buyingReason || "").trim().toLowerCase();
  if (buyingReason) {
    if (buyingReason.includes("invest")) pushTag(tags, "investor");
    if (buyingReason.includes("primary")) pushTag(tags, "primary residence");
    if (buyingReason.includes("relocat")) pushTag(tags, "relocation");
    if (buyingReason.includes("downsiz")) pushTag(tags, "downsizing");
  }

  const hasPropertyToSell = (input.hasPropertyToSell || "").trim().toLowerCase();
  if (hasPropertyToSell === "yes") pushTag(tags, "sell before buying");

  if (agency) {
    if (agency.includes("need") || agency.includes("no agent") || agency.includes("need representation")) {
      pushTag(tags, "needs representation");
    } else if (agency.includes("have") || agency.includes("already") || agency.includes("another agent")) {
      pushTag(tags, "already represented");
    }
  }

  const timeline = (input.timeline || "").trim();
  if (timeline) pushTag(tags, timeline);

  return tags;
}

export function normalizeTagList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
}

export function tagsFromSourceDetail(sourceDetail: unknown): string[] {
  if (!sourceDetail || typeof sourceDetail !== "object" || Array.isArray(sourceDetail)) return [];
  const record = sourceDetail as Record<string, unknown>;
  return normalizeTagList(record.tags);
}

export function formatTagsText(tags: string[]): string {
  return tags.join(", ");
}
