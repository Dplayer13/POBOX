import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { boxIdEquals } from "@/lib/box";
import { resolveStoragePath } from "@/lib/uploads";
import { promises as fs } from "fs";

export const runtime = "nodejs";

// GET /api/attachments/[id]
// Streams the file. Caller must be the sender or the recipient of the
// letter this attachment belongs to. Recipients can only download arrived
// attachments; senders can always re-download their own sent copy.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: { letter: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const letter = attachment.letter;
  const isSender = boxIdEquals(auth.boxId, letter.senderBoxId);
  const isRecipient = boxIdEquals(auth.boxId, letter.recipientBoxId);
  if (!isSender && !isRecipient) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (isRecipient && !isSender && letter.deliverAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const p = resolveStoragePath(attachment.storageKey);
  if (!p) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  let buf: Buffer;
  try {
    buf = await fs.readFile(p);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Force download with the original filename; never render inline (the plan
  // says "never open or render them on the server" and we keep the bucket
  // private, so the browser shouldn't try to render it either).
  const safeName = attachment.filename.replace(/[^\w.\-]+/g, "_");
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": attachment.mimeType || "application/octet-stream",
      "content-length": String(buf.length),
      "content-disposition": `attachment; filename="${safeName}"`,
      // Private files — never cached by any intermediary.
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
