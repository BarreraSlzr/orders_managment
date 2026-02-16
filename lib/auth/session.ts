/**
 * Cookie-based session management using HMAC-SHA256 signatures.
 * No external dependencies – uses the Web Crypto API available in
 * Next.js Edge Runtime and Node.js 18+.
 *
 * Session token format: `base64(payload).base64(signature)`
 */
import { getAuthConfig } from "./config";

export interface SessionPayload {
  /** Subject / user identifier */
  sub: string;
  /** Issued-at (epoch seconds) */
  iat: number;
  /** Expiry (epoch seconds) */
  exp: number;
  /** Tenant identifier for multi-tenant scope */
  tenant_id?: string;
  /** User role for RBAC */
  role?: "admin" | "manager" | "staff";
  /** Permission list for fine-grained access */
  permissions?: string[];
  /** Human-friendly username */
  username?: string;
  /** Tenant display name */
  tenant_name?: string;
  /** Arbitrary metadata carried in the session */
  [key: string]: unknown;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(buf));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Create a signed session token for the given subject.
 */
export async function createSessionToken(
  sub: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const { secret, sessionTTL } = getAuthConfig();
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    sub,
    iat: now,
    exp: now + sessionTTL,
    ...extra,
  };

  const payloadB64 = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer
  );

  const key = await getCryptoKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );

  return `${payloadB64}.${toBase64Url(sig)}`;
}

/**
 * Verify a session token and return its payload, or `null` if invalid/expired.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  const { secret } = getAuthConfig();
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;

  try {
    const key = await getCryptoKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    // Reject non-canonical base64url encodings
    if (toBase64Url(sigBytes.buffer as ArrayBuffer) !== sigB64) {
      return null;
    }
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      new TextEncoder().encode(payloadB64)
    );

    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64))
    );

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Build cookie header options for setting/clearing the session cookie.
 * Designed for cross-service sharing when `AUTH_COOKIE_DOMAIN` is set.
 */
export function getSessionCookieOptions(params: {
  maxAge?: number;
}): string {
  const { cookieName, cookieDomain, sessionTTL } = getAuthConfig();
  const maxAge = params.maxAge ?? sessionTTL;

  const parts = [
    `${cookieName}={value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];

  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);

  // In production, always use Secure
  if (process.env.NODE_ENV === "production") parts.push("Secure");

  return parts.join("; ");
}
