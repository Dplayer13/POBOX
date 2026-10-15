import { randomBytes, timingSafeEqual } from "crypto";

// Unambiguous alphabet: no 0/O, 1/I/l, etc. 30 chars.
// 30^8 ≈ 6.56e11 (656 billion) combinations — not guessable, not enumerable.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const PREFIX = "box-";
const LEN = 8;

function charsFor(len: number): string {
  // randomBytes gives uniform bytes; reject modulo bias by using only values
  // below the largest multiple of ALPHABET.length within 256.
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const out: string[] = [];
  let i = 0;
  while (out.length < len) {
    const buf = randomBytes(len * 2); // a little extra in case of rejects
    for (let k = 0; k < buf.length && out.length < len; k++) {
      const v = buf[k];
      if (v < max) out.push(ALPHABET[v % ALPHABET.length]);
    }
    if (++i > 16) break; // safety, should never trigger
  }
  return out.join("");
}

/** Generate a fresh, unique box id. Collides-check against the DB by the caller. */
export function generateBoxId(): string {
  return PREFIX + charsFor(LEN);
}

/** Generate candidates until one is unused in the DB. */
export async function uniqueBoxId(exists: (id: string) => Promise<boolean>): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const id = generateBoxId();
    if (!(await exists(id))) return id;
  }
  throw new Error("Failed to allocate a unique box id after 12 attempts");
}

const BOX_RE = new RegExp(`^${PREFIX}[${ALPHABET}]{${LEN}}$`);

/** Lenient validation for inbound addressing (case-insensitive). */
export function isValidBoxId(id: string): boolean {
  if (!id) return false;
  return BOX_RE.test(id.toLowerCase());
}

/** Constant-time-ish equality for box ids (lengths equal when both valid). */
export function boxIdEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
