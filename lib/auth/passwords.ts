import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function hashPassword(params: {
  password: string;
  salt?: string;
}): { hash: string; salt: string } {
  const salt = params.salt ?? randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(params.password, salt, KEY_LENGTH).toString("hex");
  return { hash, salt };
}

export function verifyPassword(params: {
  password: string;
  hash: string;
  salt: string;
}): boolean {
  const derived = scryptSync(params.password, params.salt, KEY_LENGTH);
  const hashBuf = Buffer.from(params.hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}
