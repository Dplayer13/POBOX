import { promises as fs } from "fs";
import path from "path";
import { randomToken } from "@/lib/crypto";
import { del } from "@vercel/blob";
import {
  extOf,
  MAX_BODY_CHARS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_LETTER,
  validateFile,
} from "@/lib/file-types";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export { MAX_BODY_CHARS, MAX_FILE_BYTES, MAX_FILES_PER_LETTER, validateFile };
export { extOf };

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
    if (p) {
      await fs.unlink(p);
    } else if (isBlobStorageKey(storageKey)) {
      await del(storageKey);
    }
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

export function isBlobStorageKey(storageKey: string): boolean {
  return /^letters\/box-[a-z2-9]{8}\/[0-9a-f]{32}\.[a-z0-9]+$/.test(
    storageKey
  );
}

export function isBlobStorageKeyForBox(
  storageKey: string,
  boxId: string
): boolean {
  return (
    isBlobStorageKey(storageKey) &&
    storageKey.startsWith(`letters/${boxId}/`)
  );
}
