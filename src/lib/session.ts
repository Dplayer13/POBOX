import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, hashToken } from "@/lib/crypto";
import type { UserPublic } from "@/lib/types";

export const SESSION_COOKIE = "pobox_session";
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

export interface AuthUser {
  user: UserPublic;
  boxId: string;
}

/** Create a new session row and return the raw token. */
export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);
  await db.session.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

export async function destroySessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  try {
    await db.session.deleteMany({ where: { tokenHash } });
  } catch {
    /* ignore — token may already be gone */
  }
}

/**
 * Read the session token from the request. Prefer the `Authorization:
 * Bearer` header (the client stores the token in localStorage and sends it
 * here — this survives cross-origin preview iframes where cookies are
 * blocked). Fall back to the httpOnly cookie for any same-origin/SSR path.
 */
async function getRequestToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth) {
    const lower = auth.toLowerCase();
    if (lower.startsWith("bearer ")) {
      const t = auth.slice(7).trim();
      if (t) return t;
    }
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Resolve a user from an explicit token (used by the attachment download
 *  route, which receives the token via ?token= because <a download> can't
 *  set custom headers). Prunes expired sessions. */
export async function getUserByToken(token: string): Promise<AuthUser | null> {
  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return {
    user: { id: session.user.id, email: session.user.email },
    boxId: session.user.boxId,
  };
}

/**
 * Resolve the authenticated user from the request (Bearer header or cookie).
 * Returns null if no/invalid/expired session. Expired sessions are pruned.
 */
export async function getUser(): Promise<AuthUser | null> {
  const token = await getRequestToken();
  if (!token) return null;
  return getUserByToken(token);
}

/** Cookie config — SameSite=None + Secure so it can ALSO be set in third-party
 *  iframe contexts when the browser allows it (defense in depth; the Bearer
 *  header is the primary auth path). */
export function sessionCookieConfig() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "none" as const,
    path: "/",
    secure: true,
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

/** Best-effort client ip extraction (Caddy forwards X-Forwarded-For). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

import { LIMITS, rateLimit, rlKey } from "@/lib/ratelimit";

/** Convenience: enforce a rate limit for an action+ip, returning a Response on failure. */
export function enforceLimit(
  action: keyof typeof LIMITS,
  ip: string
): { ok: true } | { ok: false; response: Response } {
  const cfg = LIMITS[action];
  const res = rateLimit(rlKey(action, ip), cfg.max, cfg.windowMs);
  if (!res.ok) {
    const retryAfter = Math.ceil(res.retryAfterMs / 1000);
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Too many attempts. Please slow down." }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(retryAfter),
          },
        }
      ),
    };
  }
  return { ok: true };
}
