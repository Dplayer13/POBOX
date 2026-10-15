import { promises as fs } from "fs";
import path from "path";
import { randomToken } from "@/lib/crypto";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_FILES_PER_LETTER = 5;
export const MAX_BODY_CHARS = 10000;

// Allowlist of accepted types. Anything not here is rejected.
// We intentionally block executables, scripts, and HTML (XSS surface).
const ALLOWED: { mime: string; exts: string[] }[] = [
  { mime: "image/jpeg", exts: ["jpg", "jpeg"] },
  { mime: "image/png", exts: ["png"] },
  { mime: "image/gif", exts: ["gif"] },
  { mime: "image/webp", exts: ["webp"] },
  { mime: "application/pdf", exts: ["pdf"] },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    exts: ["docx"],
  },
  { mime: "application/msword", exts: ["doc"] },
  { mime: "text/plain", exts: ["txt"] },
  { mime: "audio/mpeg", exts: ["mp3"] },
  { mime: "audio/wav", exts: ["wav"] },
  { mime: "audio/ogg", exts: ["ogg", "oga"] },
  { mime: "audio/mp4", exts: ["m4a"] },
  { mime: "audio/x-m4a", exts: ["m4a"] },
];

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i + 1).toLowerCase();
}

export interface FileInput {
  name: string;
  type: string;
  size: number;
}

export function validateFile(
  file: FileInput
): { ok: true; mimeType: string } | { ok: false; reason: string } {
  if (file.size <= 0) return { ok: false, reason: "Empty file" };
  if (file.size > MAX_FILE_BYTES)
    return { ok: false, reason: "File exceeds the 10 MB limit" };

  const ext = extOf(file.name);
  // Match by declared mime first; fall back to extension.
  const byMime = ALLOWED.find((a) => a.mime === file.type);
  if (byMime) {
    if (!byMime.exts.includes(ext)) {
      return { ok: false, reason: "File extension does not match its type" };
    }
    return { ok: true, mimeType: byMime.mime };
  }
  const byExt = ALLOWED.find((a) => a.exts.includes(ext));
  if (!byExt)
    return {
      ok: false,
      reason: "This file type is not allowed. Use images, PDF, docx, txt, or audio.",
    };
  return { ok: true, mimeType: byExt.mime };
}

/** Write bytes to a random key under UPLOADS_DIR. Returns the storage key. */
export async function persistFile(bytes: Uint8Array): Promise<string> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const key = randomToken(); // 64 hex chars
  const p = path.join(UPLOADS_DIR, key);
  await fs.writeFile(p, bytes);
  return key;
}

/** Delete a stored file by key (best-effort, for cleanup on failure). */
export async function deleteFile(storageKey: string): Promise<void> {
  try {
    const p = resolveStoragePath(storageKey);
    if (p) await fs.unlink(p);
  } catch {
    /* ignore */
  }
}

/** Resolve a storage key to a safe path inside UPLOADS_DIR, or null if invalid. */
export function resolveStoragePath(storageKey: string): string | null {
  // Strict hex check prevents any path traversal.
  if (!/^[0-9a-f]{16,128}$/.test(storageKey)) return null;
  const p = path.resolve(UPLOADS_DIR, storageKey);
  // Ensure the resolved path stays inside UPLOADS_DIR.
  if (!p.startsWith(UPLOADS_DIR + path.sep)) return null;
  return p;
}
