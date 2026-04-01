export const SOURCE_CHANNEL_VALUES = [
  "instagram",
  "facebook",
  "tiktok",
  "website_form",
  "seller_form",
  "buyer_form",
  "generic_form",
  "open_house",
  "inbound_call",
  "inbound_sms",
  "concierge", // legacy — kept for backwards compat with existing lead records
  "referral",
  "manual",
  "other",
] as const;

export const LEAD_SOURCE_CHANNEL_VALUES = [
  "ig",
  "fb",
  "webform",
  "website",
  "email",
  "phone",
  "manual",
  "import_csv",
  "other",
] as const;

export const TIMEFRAME_OPTIONS = [
  "0-3 months",
  "3-6 months",
  "6+ months",
] as const;

export type SourceChannel = (typeof SOURCE_CHANNEL_VALUES)[number];
export type LeadSourceChannel = (typeof LEAD_SOURCE_CHANNEL_VALUES)[number];
export type LeadTemperature = "Cold" | "Warm" | "Hot";
export type RecommendationPriority = "low" | "medium" | "high" | "urgent";
export type TimeframeBucket = (typeof TIMEFRAME_OPTIONS)[number];

export type InboundQualificationInput = {
  intent?: string | null;
  timeline?: string | null;
  budgetRange?: string | null;
  locationArea?: string | null;
  propertyContext?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPreference?: string | null;
  notes?: string | null;
  financingStatus?: string | null;
  sellerReadiness?: string | null;
  agencyStatus?: string | null;
};

export type QualificationResult = {
  temperature: LeadTemperature;
  score: number;
  reasons: string[];
};

export type NextActionResult = {
  priority: RecommendationPriority;
  title: string;
  description: string;
  dueAt: string;
};

function compact(value: string | null | undefined): string {
  return (value || "").trim();
}

function includesAny(value: string, matches: string[]): boolean {
  return matches.some((match) => value.includes(match));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeSourceChannel(value: string | null | undefined): SourceChannel | null {
  const source = compact(value).toLowerCase();
  if (!source) return null;

  if (includesAny(source, ["ig", "instagram"])) return "instagram";
  if (includesAny(source, ["fb", "facebook"])) return "facebook";
  if (includesAny(source, ["tiktok", "tik tok"])) return "tiktok";
  if (includesAny(source, ["open house"])) return "open_house";
  if (source === "seller_form") return "seller_form";
  if (source === "buyer_form") return "buyer_form";
  if (source === "generic_form") return "generic_form";
  if (includesAny(source, ["sms_receptionist", "inbound_sms"])) return "inbound_sms";
  if (includesAny(source, ["call_inbound", "missed_call_textback", "inbound_call", "missed call", "call"])) return "inbound_call";
  if (includesAny(source, ["concierge", "sms", "text"])) return "concierge";
  if (includesAny(source, ["referral", "referred"])) return "referral";
  if (includesAny(source, ["manual", "import"])) return "manual";
  if (includesAny(source, ["web", "form", "site", "landing"])) return "website_form";
  return "other";
}

export function normalizeLeadSourceChannel(
  value: string | null | undefined
): LeadSourceChannel | null {
  const source = compact(value).toLowerCase();
  if (!source) return null;

  if (
    source === "ig" ||
    source === "fb" ||
    source === "webform" ||
    source === "website" ||
    source === "email" ||
    source === "phone" ||
    source === "manual" ||
    source === "import_csv" ||
    source === "other"
  ) {
    return source;
  }

  const normalized = normalizeSourceChannel(source);
  if (normalized === "instagram") return "ig";
  if (normalized === "facebook") return "fb";
  if (normalized === "website_form") return "webform";
  if (normalized === "concierge") return "phone";
  if (normalized === "manual") return "manual";
  return "other";
}

export function sourceChannelLabel(value: string | null | undefined): string {
  const source = normalizeSourceChannel(value);
  if (source === "instagram") return "Instagram";
  if (source === "facebook") return "Facebook";
  if (source === "tiktok") return "TikTok";
  if (source === "website_form") return "Website Form";
  if (source === "seller_form") return "Seller Form";
  if (source === "buyer_form") return "Buyer Form";
  if (source === "generic_form") return "Generic Form";
  if (source === "open_house") return "Open House";
  if (source === "inbound_call") return "Inbound Call";
  if (source === "inbound_sms") return "Inbound SMS";
  if (source === "concierge") return "Secretary";
  if (source === "referral") return "Referral";
  if (source === "manual") return "Manual";
  if (source === "other") return "Other";
  return "Unknown";
}

export function sourceChannelTone(
  value: string | null | undefined
): "default" | "info" | "ok" | "warn" {
  const source = normalizeSourceChannel(value);
  if (source === "instagram" || source === "facebook" || source === "tiktok") return "info";
  if (source === "open_house" || source === "referral") return "ok";
  if (source === "seller_form" || source === "buyer_form" || source === "generic_form") return "ok";
  if (source === "inbound_call" || source === "inbound_sms" || source === "concierge") return "warn";
  return "default";
}

export function normalizeTimeframeBucket(
  value: string | null | undefined
): TimeframeBucket | null {
  const timeline = compact(value).toLowerCase();
  if (!timeline) return null;

  if (
    includesAny(timeline, [
      "0-3",
      "0 to 3",
      "0-30",
      "0 to 30",
      "1-3",
      "1 to 3",
      "asap",
      "ready now",
      "today",
      "this week",
      "next week",
      "this month",
      "next month",
      "immediately",
      "urgent",
      "right away",
    ])
  ) {
    return "0-3 months";
  }

  if (
    includesAny(timeline, [
      "3-6",
      "3 to 6",
      "4 month",
      "5 month",
    ])
  ) {
    return "3-6 months";
  }

  if (
    includesAny(timeline, [
      "6+",
      "6 plus",
      "6-plus",
      "6 months+",
      "6 months +",
      "over 6",
      "more than 6",
      "later",
      "long term",
      "long-term",
      "not sure",
      "someday",
      "eventually",
      "next year",
      "12 month",
      "year",
    ])
  ) {
    return "6+ months";
  }

  const monthMatch = timeline.match(/\b(\d{1,2})\s*(month|months|mo)\b/);
  if (monthMatch?.[1]) {
    const months = Number(monthMatch[1]);
    if (Number.isFinite(months)) {
      if (months <= 3) return "0-3 months";
      if (months <= 6) return "3-6 months";
      return "6+ months";
    }
  }

  const weekMatch = timeline.match(/\b(\d{1,2})\s*(week|weeks|wk|wks)\b/);
  if (weekMatch?.[1]) {
    const weeks = Number(weekMatch[1]);
    if (Number.isFinite(weeks)) {
      if (weeks <= 13) return "0-3 months";
      if (weeks <= 26) return "3-6 months";
      return "6+ months";
    }
  }

  const dayMatch = timeline.match(/\b(\d{1,3})\s*(day|days)\b/);
  if (dayMatch?.[1]) {
    const days = Number(dayMatch[1]);
    if (Number.isFinite(days)) {
      if (days <= 90) return "0-3 months";
      if (days <= 180) return "3-6 months";
      return "6+ months";
    }
  }

  return null;
}

export function leadTemperatureFromTimeframe(
  value: string | null | undefined
): LeadTemperature | null {
  const bucket = normalizeTimeframeBucket(value);
  if (bucket === "0-3 months") return "Hot";
  if (bucket === "3-6 months") return "Warm";
  if (bucket === "6+ months") return "Cold";
  return null;
}

export function inferLeadTemperature(input: InboundQualificationInput): QualificationResult {
  let score = 0;
  const reasons: string[] = [];
  const timeframe = normalizeTimeframeBucket(input.timeline);

  if (timeframe === "0-3 months") {
    score = 8;
    reasons.push("timeframe is 0-3 months");
  } else if (timeframe === "3-6 months") {
    score = 5;
    reasons.push("timeframe is 3-6 months");
  } else if (timeframe === "6+ months") {
    score = 2;
    reasons.push("timeframe is 6+ months");
  }

  const readiness = `${compact(input.financingStatus)} ${compact(input.sellerReadiness)}`.toLowerCase();
  if (
    includesAny(readiness, [
      "cash",
      "pre-approved",
      "pre approved",
      "proof of funds",
      "ready now",
      "owner",
    ])
  ) {
    score += 2;
    reasons.push("ready to act");
  } else if (readiness) {
    score += 1;
  }

  if (compact(input.locationArea) || compact(input.propertyContext)) {
    score += 1;
    reasons.push("specific location or property");
  }

  if (compact(input.budgetRange)) {
    score += 1;
  }

  if (compact(input.phone)) {
    score += 1;
  }
  if (compact(input.email) || compact(input.contactPreference)) {
    score += 1;
  }

  if (compact(input.notes).length >= 18) {
    score += 1;
  }

  const agencyStatus = compact(input.agencyStatus).toLowerCase();
  if (includesAny(agencyStatus, ["yes", "already", "another agent"])) {
    score -= 2;
    reasons.push("already working with another agent");
  }

  const normalizedScore = timeframe
    ? timeframe === "0-3 months"
      ? clamp(score, 7, 10)
      : timeframe === "3-6 months"
        ? clamp(score, 4, 6)
        : clamp(score, 0, 3)
    : clamp(score, 0, 10);

  const directTemperature =
    leadTemperatureFromTimeframe(input.timeline) ||
    (normalizedScore >= 7 ? "Hot" : normalizedScore >= 4 ? "Warm" : "Cold");

  if (directTemperature === "Hot") {
    return {
      temperature: "Hot",
      score: normalizedScore,
      reasons: reasons.length > 0 ? reasons : ["timeframe is 0-3 months"],
    };
  }
  if (directTemperature === "Warm") {
    return {
      temperature: "Warm",
      score: normalizedScore,
      reasons: reasons.length > 0 ? reasons : ["timeframe is 3-6 months"],
    };
  }
  return {
    temperature: "Cold",
    score: normalizedScore,
    reasons: reasons.length > 0 ? reasons : ["timeframe is 6+ months"],
  };
}

export function inferLeadStage(temperature: LeadTemperature): "New" | "Contacted" {
  if (temperature === "Hot") return "Contacted";
  return "New";
}

export function inferDealType(intent: string | null | undefined): "buyer" | "listing" {
  const normalized = compact(intent).toLowerCase();
  if (includesAny(normalized, ["sell", "seller", "listing"])) {
    return "listing";
  }
  return "buyer";
}

export function buildPropertyContext(input: InboundQualificationInput): string {
  const property = compact(input.propertyContext);
  if (property) return property;
  const area = compact(input.locationArea);
  if (area) return `${area} inquiry`;
  const intent = compact(input.intent);
  if (intent) return `${intent} inquiry`;
  return "New inbound inquiry";
}

export function inferNextAction(
  input: InboundQualificationInput,
  qualification: QualificationResult
): NextActionResult {
  const preference = compact(input.contactPreference).toLowerCase();
  const source = compact(input.intent);
  const reachMethod = preference.includes("email")
    ? "email"
    : preference.includes("call")
      ? "call"
      : "text";

  if (qualification.temperature === "Hot") {
    return {
      priority: "urgent",
      title: reachMethod === "call" ? "Call now" : `Reach out by ${reachMethod} now`,
      description: `This looks time-sensitive. ${reachMethod === "call" ? "Call first if possible." : `Send a ${reachMethod} first, then follow with a call if needed.`}`,
      dueAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  if (qualification.temperature === "Warm") {
    return {
      priority: "high",
      title: `Follow up today`,
      description: `Good ${source ? source.toLowerCase() : "inbound"} opportunity with enough detail to move forward today.`,
      dueAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    };
  }

  return {
    priority: "medium",
    title: "Send a light follow-up",
    description: "Keep this moving, but it does not need immediate attention.",
    dueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
  };
}

export function buildTemperatureReason(qualification: QualificationResult): string {
  const prefix =
    qualification.temperature === "Hot"
      ? "Hot lead"
      : qualification.temperature === "Warm"
        ? "Warm lead"
        : "Cold lead";
  return `${prefix}: ${qualification.reasons.join(", ")}.`;
}
