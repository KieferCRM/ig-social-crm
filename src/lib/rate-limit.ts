type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

declare global {
  var __lockbox_rate_limit_store__: Map<string, Bucket> | undefined;
  var __lockbox_rate_limit_warned_redis__: boolean | undefined;
}

const store = globalThis.__lockbox_rate_limit_store__ || new Map<string, Bucket>();
globalThis.__lockbox_rate_limit_store__ = store;
globalThis.__lockbox_rate_limit_warned_redis__ =
  globalThis.__lockbox_rate_limit_warned_redis__ || false;

function redisConfig() {
  const url = process.env.RATE_LIMIT_REDIS_REST_URL?.trim() || "";
  const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN?.trim() || "";
  if (!url || !token) return null;
  return { url, token };
}

function cleanupExpired(now: number): void {
  // Keep cleanup cheap and opportunistic.
  if (store.size < 500) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

function takeMemoryRateLimit({ key, limit, windowMs }: RateLimitInput): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  existing.count += 1;
  store.set(key, existing);

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec,
  };
}

async function takeRedisRateLimit({ key, limit, windowMs }: RateLimitInput): Promise<RateLimitResult | null> {
  const config = redisConfig();
  if (!config) return null;

  const redisKey = `lockbox:rl:${key}`;
  const pipelineUrl = `${config.url.replace(/\/$/, "")}/pipeline`;

  try {
    const response = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs), "NX"],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Redis REST pipeline failed: ${response.status}`);
    }

    const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(payload?.[0]?.result ?? 0);
    const pttl = Number(payload?.[2]?.result ?? windowMs);

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("Redis REST returned invalid counter.");
    }

    const ttlMs = Number.isFinite(pttl) && pttl > 0 ? pttl : windowMs;
    const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSec,
    };
  } catch (error) {
    if (!globalThis.__lockbox_rate_limit_warned_redis__) {
      globalThis.__lockbox_rate_limit_warned_redis__ = true;
      console.warn("[rate-limit] Redis unavailable, falling back to in-memory buckets", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return null;
  }
}

export async function takeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const redisResult = await takeRedisRateLimit(input);
  if (redisResult) return redisResult;
  return takeMemoryRateLimit(input);
}
