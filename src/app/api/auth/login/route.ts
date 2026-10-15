import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { createSession, sessionCookieConfig, getClientIp, enforceLimit } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = enforceLimit("login", ip);
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email and password." },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Always run a verify against a dummy hash when the user is missing, so a
  // missing user and a wrong password take roughly the same time (no enumeration).
  const DUMMY_HASH =
    "scrypt$16384$8$1$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, boxId: true, passwordHash: true },
  });
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const ok = verifyPassword(password, hashToCheck);
  if (!user || !ok) {
    return NextResponse.json(
      { error: "Wrong email or password." },
      { status: 401 }
    );
  }

  const token = await createSession(user.id);
  const res = NextResponse.json<AuthResponse>({
    user: { id: user.id, email: user.email },
    boxId: user.boxId,
    token, // client stores this in localStorage + sends as Bearer
  });
  res.cookies.set(sessionCookieConfig().name, token, sessionCookieConfig());
  return res;
}
