import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser, getClientIp, enforceLimit } from "@/lib/session";
import { isValidBoxId } from "@/lib/box";
import {
  validateFile,
  persistFile,
  deleteFile,
  MAX_BODY_CHARS,
  MAX_FILES_PER_LETTER,
} from "@/lib/uploads";
import { toListItem, toDetail, DELIVERY_DELAY_MS } from "@/lib/letter";
import type { LetterDetail, LetterListItem } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/letters?box=inbox|sent
export async function GET(req: Request) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const which = url.searchParams.get("box") === "sent" ? "sent" : "inbox";

  const now = new Date();
  if (which === "inbox") {
    // Recipient only ever sees letters that have ARRIVED (deliverAt <= now).
    // Before that, the letter is still in transit and doesn't exist in the
    // recipient's inbox yet — this is what makes the delivery delay real.
    const rows = await db.letter.findMany({
      where: { recipientBoxId: auth.boxId, deliverAt: { lte: now } },
      include: { attachments: true },
      orderBy: { deliverAt: "desc" },
    });
    return NextResponse.json<{ letters: LetterListItem[] }>({
      letters: rows.map(toListItem),
    });
  } else {
    // Sender sees everything they sent, including letters still in transit,
    // so they can watch the journey (sent → in transit → delivered).
    const rows = await db.letter.findMany({
      where: { senderBoxId: auth.boxId },
      include: { attachments: true },
      orderBy: { sentAt: "desc" },
    });
    return NextResponse.json<{ letters: LetterListItem[] }>({
      letters: rows.map(toListItem),
    });
  }
}

// POST /api/letters  (multipart/form-data)
// fields: recipientBoxId (string), body (string)
// files:  up to 5 under field name "files"
export async function POST(req: Request) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = enforceLimit("send", auth.boxId);
  if (!limited.ok) return limited.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 }
    );
  }

  const recipientBoxIdRaw = String(form.get("recipientBoxId") ?? "").trim();
  const bodyRaw = String(form.get("body") ?? "");

  if (!isValidBoxId(recipientBoxIdRaw)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid box ID." },
      { status: 400 }
    );
  }
  const body = bodyRaw.slice(0, MAX_BODY_CHARS);
  // The plan allows letters that are just files; require at least one of
  // body or attachment.
  const fileEntries = form.getAll("files").filter((f): f is File => f instanceof File);
  if (fileEntries.length > MAX_FILES_PER_LETTER) {
    return NextResponse.json(
      { error: `You can attach at most ${MAX_FILES_PER_LETTER} files per letter.` },
      { status: 400 }
    );
  }
  if (body.trim().length === 0 && fileEntries.length === 0) {
    return NextResponse.json(
      { error: "Your letter is empty. Write something or attach a file." },
      { status: 400 }
    );
  }

  // Validate + read every file into memory (≤10MB each, ≤5 files ⇒ ≤50MB).
  // Production would stream to object storage; this is fine for the sandbox.
  const staged: { bytes: Uint8Array; filename: string; mimeType: string; size: number }[] = [];
  for (const f of fileEntries) {
    const v = validateFile({ name: f.name, type: f.type, size: f.size });
    if (!v.ok) {
      return NextResponse.json({ error: `${f.name}: ${v.reason}` }, { status: 400 });
    }
    const ab = await f.arrayBuffer();
    staged.push({
      bytes: new Uint8Array(ab),
      filename: f.name,
      mimeType: v.mimeType,
      size: f.size,
    });
  }

  // Write files to disk first, collecting storage keys.
  const writtenKeys: string[] = [];
  for (const s of staged) {
    try {
      const key = await persistFile(s.bytes);
      writtenKeys.push(key);
    } catch {
      // Clean up any files we already wrote, then bail.
      await Promise.all(writtenKeys.map(deleteFile));
      return NextResponse.json(
        { error: "We couldn't store one of your files. Please try again." },
        { status: 500 }
      );
    }
  }

  const deliverAt = new Date(Date.now() + DELIVERY_DELAY_MS);

  try {
    const letter = await db.letter.create({
      data: {
        senderBoxId: auth.boxId,
        recipientBoxId: recipientBoxIdRaw.toLowerCase(),
        body,
        deliverAt,
        attachments: {
          create: staged.map((s, i) => ({
            filename: s.filename,
            mimeType: s.mimeType,
            size: s.size,
            storageKey: writtenKeys[i],
          })),
        },
      },
      include: { attachments: true },
    });
    return NextResponse.json<{ letter: LetterDetail }>(
      { letter: toDetail(letter) },
      { status: 201 }
    );
  } catch {
    // DB failed — delete the files we wrote so we don't leak orphans.
    await Promise.all(writtenKeys.map(deleteFile));
    return NextResponse.json(
      { error: "We couldn't send your letter. Please try again." },
      { status: 500 }
    );
  }
}
