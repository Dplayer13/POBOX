import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser, getClientIp, enforceLimit } from "@/lib/session";
import { isValidBoxId } from "@/lib/box";
import { BlobNotFoundError, head } from "@vercel/blob";
import {
  deleteFile,
  isBlobStorageKeyForBox,
  MAX_BODY_CHARS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_LETTER,
  validateFile,
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

// POST /api/letters  (application/json)
// Includes uploaded Blob pathnames; file bytes are sent directly to Blob storage.
export async function POST(req: Request) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = enforceLimit("send", auth.boxId);
  if (!limited.ok) return limited.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON request data." },
      { status: 400 }
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  const data = payload as {
    recipientBoxId?: unknown;
    body?: unknown;
    files?: unknown;
  };
  const recipientBoxIdRaw =
    typeof data.recipientBoxId === "string" ? data.recipientBoxId.trim() : "";
  const bodyRaw = typeof data.body === "string" ? data.body : "";

  if (!isValidBoxId(recipientBoxIdRaw)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid box ID." },
      { status: 400 }
    );
  }
  const body = bodyRaw.slice(0, MAX_BODY_CHARS);
  if (data.files !== undefined && !Array.isArray(data.files)) {
    return NextResponse.json({ error: "Invalid attachment data." }, { status: 400 });
  }
  const fileEntries = Array.isArray(data.files) ? data.files : [];
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

  const staged: {
    pathname: string;
    filename: string;
    mimeType: string;
    size: number;
  }[] = [];
  const ownedPaths: string[] = [];
  const rejectWithCleanup = async (message: string) => {
    await Promise.all(ownedPaths.map(deleteFile));
    return NextResponse.json({ error: message }, { status: 400 });
  };

  for (const entry of fileEntries) {
    if (!entry || typeof entry !== "object") {
      return rejectWithCleanup("Invalid attachment data.");
    }
    const file = entry as {
      pathname?: unknown;
      filename?: unknown;
      mimeType?: unknown;
      size?: unknown;
    };
    if (
      typeof file.pathname !== "string" ||
      !isBlobStorageKeyForBox(file.pathname, auth.boxId)
    ) {
      return rejectWithCleanup("Invalid attachment path.");
    }
    ownedPaths.push(file.pathname);
    if (
      typeof file.filename !== "string" ||
      typeof file.mimeType !== "string" ||
      typeof file.size !== "number" ||
      !Number.isInteger(file.size)
    ) {
      return rejectWithCleanup("Invalid attachment data.");
    }

    const validation = validateFile({
      name: file.filename,
      type: file.mimeType,
      size: file.size,
    });
    if (!validation.ok || validation.mimeType !== file.mimeType) {
      return rejectWithCleanup(
        `${file.filename}: ${validation.ok ? "File type does not match." : validation.reason}`
      );
    }
    let blob: Awaited<ReturnType<typeof head>>;
    try {
      blob = await head(file.pathname);
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return rejectWithCleanup(`${file.filename}: Upload not found.`);
      }
      throw error;
    }
    if (
      blob.size !== file.size ||
      blob.size > MAX_FILE_BYTES ||
      blob.contentType !== validation.mimeType
    ) {
      return rejectWithCleanup(`${file.filename}: Uploaded file details do not match.`);
    }
    staged.push({
      pathname: file.pathname,
      filename: file.filename,
      mimeType: validation.mimeType,
      size: blob.size,
    });
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
          create: staged.map((s) => ({
            filename: s.filename,
            mimeType: s.mimeType,
            size: s.size,
            storageKey: s.pathname,
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
    await Promise.all(ownedPaths.map(deleteFile));
    return NextResponse.json(
      { error: "We couldn't send your letter. Please try again." },
      { status: 500 }
    );
  }
}
