/**
 * Tiny in-memory rate limiter (sliding window per key).
 * Good enough for a single-instance sandbox MVP. A token-bucket would be
 * fine too; this is straightforward and correct for our needs.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Periodically purge expired buckets so the map doesn't grow forever.
const PURGE_EVERY = 60_000;
let lastPurge = Date.now();
function maybePurge(now: number) {
  if (now - lastPurge < PURGE_EVERY) return;
  lastPurge = now;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** ms until the window resets and one more attempt is allowed */
  retryAfterMs: number;
  /** remaining attempts in the current window */
  remaining: number;
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  maybePurge(now);
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0, remaining: max - 1 };
  }
  if (existing.count >= max) {
    return { ok: false, retryAfterMs: existing.resetAt - now, remaining: 0 };
  }
  existing.count += 1;
  return {
    ok: true,
    retryAfterMs: 0,
    remaining: max - existing.count,
  };
}

/** Helper to build a key that includes the action + an identifier (e.g. ip). */
export function rlKey(action: string, id: string) {
  return `${action}:${id}`;
}

// Sensible shared presets (exported so callers stay consistent).
export const LIMITS = {
  signup: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour / ip
  login: { max: 10, windowMs: 60 * 60 * 1000 }, // 10 / hour / ip
  send: { max: 20, windowMs: 60 * 60 * 1000 }, // 20 / hour / user
  upload: { max: 30, windowMs: 60 * 60 * 1000 }, // 30 / hour / user
} as const;
