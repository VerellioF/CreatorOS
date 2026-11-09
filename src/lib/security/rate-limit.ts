import { headers } from "next/headers";

interface RateLimitBucket {
  timestamps: number[];
  expiresAt: number;
}

export interface RateLimitCheckOptions {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const MAX_TRACKED_KEYS = 5_000;
const rateLimitStore = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(now: number): void {
  if (rateLimitStore.size < MAX_TRACKED_KEYS) {
    return;
  }

  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  // If still full under heavy cardinality attack, evict oldest inserted entry
  if (rateLimitStore.size >= MAX_TRACKED_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey !== undefined) {
      rateLimitStore.delete(oldestKey);
    }
  }
}

/**
 * Pure sliding-window rate limiter safe for unit tests and server execution.
 */
export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: RateLimitCheckOptions): RateLimitResult {
  pruneExpiredBuckets(now);

  const windowStart = now - windowMs;
  const existing = rateLimitStore.get(key);
  const activeTimestamps = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (activeTimestamps.length >= limit) {
    const oldestActive = activeTimestamps[0] ?? now;
    const retryAfterMs = Math.max(1_000, oldestActive + windowMs - now);
    rateLimitStore.set(key, {
      timestamps: activeTimestamps,
      expiresAt: now + windowMs,
    });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1_000),
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(key, {
    timestamps: activeTimestamps,
    expiresAt: now + windowMs,
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - activeTimestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Clears in-memory rate-limit state (used in isolated automated tests).
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Extracts best-effort client IP from Next.js request headers, falling back safely
 * when invoked outside a request scope (e.g., automated unit tests).
 */
export async function getClientIpAddress(): Promise<string> {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    if (forwardedFor) {
      const firstHop = forwardedFor.split(",")[0]?.trim();
      if (firstHop && firstHop.length <= 64) {
        return firstHop;
      }
    }

    const realIp = headerStore.get("x-real-ip")?.trim();
    if (realIp && realIp.length <= 64) {
      return realIp;
    }
  } catch {
    // Outside Next.js request context (e.g., Vitest)
  }

  return "unknown-ip";
}

/**
 * Enforces sliding-window rate limiting on Next.js Server Actions and Route Handlers.
 */
export async function enforceServerActionRateLimit(params: {
  action: string;
  identifier?: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const clientIp = await getClientIpAddress();
  const normalizedId = (params.identifier || "anon").trim().toLowerCase().slice(0, 128);
  const compositeKey = `${params.action}:${clientIp}:${normalizedId}`;

  return checkRateLimit({
    key: compositeKey,
    limit: params.limit,
    windowMs: params.windowMs,
  });
}
