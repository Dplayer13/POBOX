import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { toDetail } from "@/lib/letter";
import { boxIdEquals } from "@/lib/box";
import type { LetterDetail } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/letters/[id]
// Caller must be the sender OR the recipient of THIS letter.
// The recipient cannot read a letter before it has arrived (deliverAt <= now).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const letter = await db.letter.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!letter) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isSender = boxIdEquals(auth.boxId, letter.senderBoxId);
  const isRecipient = boxIdEquals(auth.boxId, letter.recipientBoxId);
  if (!isSender && !isRecipient) {
    // Never reveal that this letter exists to a third party.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Recipients can only open arrived letters. Senders can always re-read.
  if (isRecipient && !isSender && letter.deliverAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json<{ letter: LetterDetail }>({ letter: toDetail(letter) });
}

// PATCH /api/letters/[id]  { opened: true }
// Only the recipient may mark a letter opened. Must have arrived.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const letter = await db.letter.findUnique({ where: { id } });
  if (!letter) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!boxIdEquals(auth.boxId, letter.recipientBoxId)) {
    // Only the recipient can open a letter. The sender's "sent" copy is
    // already open to them; we don't track a separate "openedBySender".
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (letter.deliverAt.getTime() > Date.now()) {
    return NextResponse.json(
      { error: "This letter hasn't arrived yet." },
      { status: 403 }
    );
  }
  if (!letter.openedAt) {
    const updated = await db.letter.update({
      where: { id },
      data: { openedAt: new Date() },
      include: { attachments: true },
    });
    return NextResponse.json<{ letter: LetterDetail }>({
      letter: toDetail(updated),
    });
  }
  // Already opened — idempotent.
  const full = await db.letter.findUnique({
    where: { id },
    include: { attachments: true },
  });
  return NextResponse.json<{ letter: LetterDetail }>({
    letter: toDetail(full!),
  });
}
