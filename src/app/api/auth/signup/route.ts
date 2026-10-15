import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { uniqueBoxId } from "@/lib/box";
import { createSession, sessionCookieConfig, getClientIp, enforceLimit } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = enforceLimit("signup", ip);
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
      { error: "Please enter a valid email and a password of at least 8 characters." },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "That email is already registered. Try logging in." },
      { status: 409 }
    );
  }

  const boxId = await uniqueBoxId(async (id) => {
    const u = await db.user.findUnique({
      where: { boxId: id },
      select: { id: true },
    });
    return !!u;
  });

  const passwordHash = hashPassword(password);
  const user = await db.user.create({
    data: { email: normalizedEmail, passwordHash, boxId },
    select: { id: true, email: true, boxId: true },
  });

  const token = await createSession(user.id);
  const res = NextResponse.json<AuthResponse>({
    user: { id: user.id, email: user.email },
    boxId: user.boxId,
    token, // client stores this in localStorage + sends as Bearer
  });
  res.cookies.set(sessionCookieConfig().name, token, sessionCookieConfig());
  return res;
}
