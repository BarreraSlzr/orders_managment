import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const TOKEN_PREFIX = "enc:v1:";

// Override injected by platformConfig after DB load — avoids making all
// crypto functions async while still supporting DB-sourced encryption keys.
let _keyOverride: string | null | undefined = undefined;

/**
 * Injects an encryption key from an external source (e.g. DB platform config).
 * Pass `null` to explicitly clear; `undefined` (default) means "not set yet".
 */
export function setEncryptionKeyOverride(key: string | null): void {
  _keyOverride = key;
}

function getEncryptionSecret(): string | null {
  if (_keyOverride !== undefined) return _keyOverride;
  return process.env.MP_TOKENS_ENCRYPTION_KEY || process.env.AUTH_SECRET || null;
}

function getKey(): Buffer | null {
  const secret = getEncryptionSecret();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptMpToken(value: string): string {
  const key = getKey();
  if (!key) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${encode(iv)}.${encode(tag)}.${encode(encrypted)}`;
}

export function decryptMpToken(value: string): string {
  if (!value.startsWith(TOKEN_PREFIX)) return value;

  const key = getKey();
  if (!key) {
    throw new Error(
      "MercadoPago token is encrypted but no MP_TOKENS_ENCRYPTION_KEY/AUTH_SECRET is configured",
    );
  }

  const payload = value.slice(TOKEN_PREFIX.length);
  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted MercadoPago token format");
  }

  const iv = decode(ivEncoded);
  const tag = decode(tagEncoded);
  const encrypted = decode(encryptedEncoded);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}

export function isMpTokenEncrypted(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX);
}
