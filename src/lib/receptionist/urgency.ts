const STRONG_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(call me|call now|need a call|can you call)\b/i, weight: 35 },
  { pattern: /\b(asap|urgent|immediately|right now|ready now)\b/i, weight: 30 },
  { pattern: /\b(today|tonight|this week|tour|offer)\b/i, weight: 22 },
  { pattern: /\bpre-?approved|cash buyer|listing this week\b/i, weight: 18 },
];

export type UrgencyDetection = {
  score: number;
  isHigh: boolean;
  matchedKeywords: string[];
};

function normalizeKeywords(value: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of value) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(key);
  }
  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectUrgency(
  messageText: string,
  escalationKeywords: string[]
): UrgencyDetection {
  const text = messageText.trim();
  if (!text) {
    return { score: 0, isHigh: false, matchedKeywords: [] };
  }

  const lower = text.toLowerCase();
  const normalizedKeywords = normalizeKeywords(escalationKeywords);
  const matchedKeywords: string[] = [];

  for (const keyword of normalizedKeywords) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    if (!pattern.test(lower)) continue;
    matchedKeywords.push(keyword);
  }

  let score = Math.min(60, matchedKeywords.length * 20);

  for (const strong of STRONG_PATTERNS) {
    if (!strong.pattern.test(lower)) continue;
    score += strong.weight;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    isHigh: score >= 50,
    matchedKeywords,
  };
}
