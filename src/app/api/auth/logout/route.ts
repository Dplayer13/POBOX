import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Read the token from the Authorization header (primary) or the cookie.
  let token: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth) {
    const lower = auth.toLowerCase();
    if (lower.startsWith("bearer ")) token = auth.slice(7).trim();
  }
  if (!token) {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value ?? null;
  }
  if (token) {
    const tokenHash = hashToken(token);
    try {
      await db.session.deleteMany({ where: { tokenHash } });
    } catch {
      /* ignore */
    }
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  return res;
}
