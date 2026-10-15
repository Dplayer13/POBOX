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

// Rate-limit presets. The box-id space (30^8 ≈ 656 billion) makes blind
// guessing infeasible on its own, so these are defense-in-depth. Kept generous
// for a shared preview IP where one person may be testing many flows.
export const LIMITS = {
  signup: { max: 50, windowMs: 60 * 60 * 1000 }, // 50 / hour / ip
  login: { max: 100, windowMs: 60 * 60 * 1000 }, // 100 / hour / ip
  send: { max: 200, windowMs: 60 * 60 * 1000 }, // 200 / hour / user
  upload: { max: 200, windowMs: 60 * 60 * 1000 }, // 200 / hour / user
} as const;
