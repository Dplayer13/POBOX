import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { enforceLimit, getUser } from "@/lib/session";
import { extOf, MAX_FILE_BYTES, validateFile } from "@/lib/file-types";
import { isBlobStorageKeyForBox } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("type" in body)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const event = body as HandleUploadBody;
  if (event.type === "blob.upload-completed") {
    const result = await handleUpload({
      body: event,
      request: req,
      onBeforeGenerateToken: async () => {
        throw new Error("Unexpected upload token request.");
      },
    });
    return NextResponse.json(result);
  }

  if (
    event.type !== "blob.generate-client-token" ||
    !event.payload ||
    typeof event.payload.pathname !== "string" ||
    event.payload.pathname.length > 256 ||
    typeof event.payload.clientPayload !== "string" ||
    event.payload.clientPayload.length > 2048
  ) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = enforceLimit("upload", auth.boxId);
  if (!limited.ok) return limited.response;

  let metadata: unknown;
  try {
    metadata = JSON.parse(event.payload.clientPayload);
  } catch {
    return NextResponse.json({ error: "Invalid file details." }, { status: 400 });
  }
  if (!metadata || typeof metadata !== "object") {
    return NextResponse.json({ error: "Invalid file details." }, { status: 400 });
  }

  const file = metadata as { filename?: unknown; type?: unknown; size?: unknown };
  if (
    typeof file.filename !== "string" ||
    typeof file.type !== "string" ||
    typeof file.size !== "number" ||
    !Number.isInteger(file.size) ||
    !isBlobStorageKeyForBox(event.payload.pathname, auth.boxId) ||
    extOf(event.payload.pathname) !== extOf(file.filename)
  ) {
    return NextResponse.json({ error: "Invalid file details." }, { status: 400 });
  }

  const validation = validateFile({
    name: file.filename,
    type: file.type,
    size: file.size,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File uploads aren't configured on this server. Set BLOB_READ_WRITE_TOKEN and restart the app.",
      },
      { status: 503 }
    );
  }

  const result = await handleUpload({
    body: event,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      if (
        pathname !== event.payload.pathname ||
        clientPayload !== event.payload.clientPayload
      ) {
        throw new Error("Upload details changed.");
      }
      return {
        allowedContentTypes: [validation.mimeType],
        maximumSizeInBytes: MAX_FILE_BYTES,
        validUntil: Date.now() + 15 * 60 * 1000,
        addRandomSuffix: false,
        tokenPayload: auth.boxId,
      };
    },
  });

  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid cleanup request." }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("pathnames" in payload) ||
    !Array.isArray(payload.pathnames) ||
    payload.pathnames.length > 5 ||
    !payload.pathnames.every(
      (pathname): pathname is string =>
        typeof pathname === "string" &&
        isBlobStorageKeyForBox(pathname, auth.boxId)
    )
  ) {
    return NextResponse.json({ error: "Invalid cleanup request." }, { status: 400 });
  }

  if (payload.pathnames.length > 0) {
    await del(payload.pathnames);
  }
  return new Response(null, { status: 204 });
}
