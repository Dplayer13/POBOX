import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { getUser, getUserByToken } from "@/lib/session";
import { boxIdEquals } from "@/lib/box";
import { isBlobStorageKey, resolveStoragePath } from "@/lib/uploads";
import { promises as fs } from "fs";

export const runtime = "nodejs";

// GET /api/attachments/[id]?token=<session>
// Streams the file. Caller must be the sender or the recipient of the
// letter this attachment belongs to. Recipients can only download arrived
// attachments; senders can always re-download their own sent copy.
// The token may come via ?token= (so <a download> works in the preview
// iframe, where it can't set headers), the Bearer header, or the cookie.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  const auth =
    (queryToken ? await getUserByToken(queryToken) : null) ?? (await getUser());
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

  const safeName = attachment.filename.replace(/[^\w.\-]+/g, "_");
  const p = resolveStoragePath(attachment.storageKey);
  if (!p && isBlobStorageKey(attachment.storageKey)) {
    const blob = await get(attachment.storageKey, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return new NextResponse(blob.stream, {
      status: 200,
      headers: {
        "content-type": attachment.mimeType || "application/octet-stream",
        "content-length": String(blob.blob.size),
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (!p) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  let buf: Buffer;
  try {
    buf = await fs.readFile(p);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

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
