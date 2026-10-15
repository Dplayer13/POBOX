import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";

/**
 * Password hashing with Node's built-in scrypt (no extra deps).
 * Format: "scrypt$N$r$p$saltHex$hashHex"
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.toString("hex")}${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  // ["scrypt", N, r, p, saltHex, hashHex]
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!N || !r || !p) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length, { N, r, p });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** 32-byte random token, hex-encoded (64 chars). */
export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

/** sha256 hex of a token — what we store in the DB so a leak can't be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
