export const SOURCE_CHANNEL_VALUES = [
  "instagram",
  "facebook",
  "tiktok",
  "website_form",
  "open_house",
  "concierge",
  "referral",
  "manual",
  "other",
] as const;

export type SourceChannel = (typeof SOURCE_CHANNEL_VALUES)[number];
export type LeadTemperature = "Cold" | "Warm" | "Hot";
export type RecommendationPriority = "low" | "medium" | "high" | "urgent";

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

export function normalizeSourceChannel(value: string | null | undefined): SourceChannel | null {
  const source = compact(value).toLowerCase();
  if (!source) return null;

  if (includesAny(source, ["ig", "instagram"])) return "instagram";
  if (includesAny(source, ["fb", "facebook"])) return "facebook";
  if (includesAny(source, ["tiktok", "tik tok"])) return "tiktok";
  if (includesAny(source, ["open house"])) return "open_house";
  if (includesAny(source, ["concierge", "missed call", "call", "sms", "text"])) return "concierge";
  if (includesAny(source, ["referral", "referred"])) return "referral";
  if (includesAny(source, ["manual", "import"])) return "manual";
  if (includesAny(source, ["web", "form", "site", "landing"])) return "website_form";
  return "other";
}

export function sourceChannelLabel(value: string | null | undefined): string {
  const source = normalizeSourceChannel(value);
  if (source === "instagram") return "Instagram";
  if (source === "facebook") return "Facebook";
  if (source === "tiktok") return "TikTok";
  if (source === "website_form") return "Website Form";
  if (source === "open_house") return "Open House";
  if (source === "concierge") return "Concierge";
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
  if (source === "concierge") return "warn";
  return "default";
}

export function inferLeadTemperature(input: InboundQualificationInput): QualificationResult {
  let score = 0;
  const reasons: string[] = [];

  const timeline = compact(input.timeline).toLowerCase();
  if (
    includesAny(timeline, ["asap", "today", "this week", "0-30", "30 days", "immediately"])
  ) {
    score += 3;
    reasons.push("near-term timeline");
  } else if (includesAny(timeline, ["1-3", "1 to 3", "60", "90"])) {
    score += 2;
    reasons.push("clear timeline");
  } else if (timeline) {
    score += 1;
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

  const normalizedScore = Math.max(0, Math.min(score, 10));
  if (normalizedScore >= 7) {
    return {
      temperature: "Hot",
      score: normalizedScore,
      reasons: reasons.length > 0 ? reasons : ["high-intent inquiry"],
    };
  }
  if (normalizedScore >= 4) {
    return {
      temperature: "Warm",
      score: normalizedScore,
      reasons: reasons.length > 0 ? reasons : ["qualified enough for follow-up"],
    };
  }
  return {
    temperature: "Cold",
    score: normalizedScore,
    reasons: reasons.length > 0 ? reasons : ["early or incomplete inquiry"],
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
