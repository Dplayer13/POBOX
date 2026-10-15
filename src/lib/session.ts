import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, hashToken } from "@/lib/crypto";
import type { UserPublic } from "@/lib/types";

export const SESSION_COOKIE = "pobox_session";
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

export interface AuthUser {
  user: UserPublic;
  boxId: string;
}

/** Create a new session row and return the raw token (goes into the cookie). */
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
 * Resolve the authenticated user from the request cookie.
 * Returns null if no session, the session is expired, or the user is gone.
 * Expired sessions are pruned on read.
 */
export async function getUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
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

export function sessionCookieConfig() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
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
