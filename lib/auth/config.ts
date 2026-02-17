/**
 * Auth configuration – reads all secrets/config from environment variables.
 * All auth-related env vars live in `.env.local` (never committed).
 */

export interface AuthConfig {
  /** HMAC secret for signing session tokens (min 32 chars) */
  secret: string;
  /** Cookie name shared across services */
  cookieName: string;
  /** Session time-to-live in seconds */
  sessionTTL: number;
  /** Allowed origins for cross-service cookie sharing */
  allowedOrigins: string[];
  /** Cookie domain for cross-service sharing (empty = current domain) */
  cookieDomain: string;
}

let _config: AuthConfig | null = null;

export function getAuthConfig(): AuthConfig {
  if (_config) return _config;

  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set in .env.local and be at least 32 characters. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  const rawCookieDomain = process.env.AUTH_COOKIE_DOMAIN || "";
  const cookieDomain = rawCookieDomain.includes("*") ? "" : rawCookieDomain;

  _config = {
    secret,
    cookieName: process.env.AUTH_COOKIE_NAME || "__session",
    sessionTTL: parseInt(process.env.AUTH_SESSION_TTL || "604800", 10),
    allowedOrigins: (process.env.AUTH_ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    cookieDomain,
  };

  return _config;
}

/**
 * Reset cached config – used in tests to re-read env vars.
 */
export function resetAuthConfig(): void {
  _config = null;
}
