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
}): string[] {
  const tags: string[] = [];
  const intent = (input.intent || "").trim().toLowerCase();
  const temp = (input.leadTemp || "").trim().toLowerCase();
  const source = normalizeSourceChannel(input.source);

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
