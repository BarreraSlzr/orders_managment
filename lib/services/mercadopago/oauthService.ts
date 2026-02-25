/**
 * oauthService — MercadoPago OAuth 2.0 flow helpers.
 *
 * Implements the authorization code grant flow for MercadoPago:
 * 1. Generate authorize URL with state parameter
 * 2. Exchange authorization code for access token
 * 3. Fetch user info to get MP user_id
 *
 * Reference: https://www.mercadopago.com.mx/developers/en/docs/security/oauth
 */

/**
 * Country-specific auth domain for MercadoPago OAuth.
 * Override via MP_AUTH_BASE_URL env var for other countries
 * (e.g. auth.mercadopago.com.ar, auth.mercadopago.com.br).
 */
const MP_AUTH_BASE_URL =
  process.env.MP_AUTH_BASE_URL || "https://auth.mercadopago.com.mx";
const MP_API_BASE_URL = process.env.MP_API_BASE_URL || "https://api.mercadopago.com.mx";

/** Timeout for all MP OAuth / API calls (20s). */
const MP_OAUTH_TIMEOUT_MS = 20_000;

/**
 * Creates a fetch call with an AbortController timeout.
 * Cleans up the timer regardless of outcome.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = MP_OAUTH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  user_id: number;
  public_key: string;
}

export interface OAuthUserInfo {
  id: number;
  nickname: string;
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Resolves the app base URL from environment or an explicit origin.
 * Priority: explicit origin > VERCEL_URL > localhost fallback.
 */
function resolveBaseUrl(origin?: string): string {
  if (origin) return origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Returns OAuth config from environment variables.
 * Throws if any required var is missing.
 *
 * `origin` is used to resolve `MP_REDIRECT_URI` when it's a relative
 * path (e.g. `/api/mercadopago/oauth/callback`).  Route handlers should pass
 * `new URL(request.url).origin` so the redirect_uri sent to MercadoPago is
 * always an absolute URL.
 */
export function getOAuthConfig(params?: { origin?: string }): OAuthConfig {
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  const redirectPath = process.env.MP_REDIRECT_URI;

  if (!clientId) {
    throw new Error("MP_CLIENT_ID environment variable is required");
  }
  if (!clientSecret) {
    throw new Error("MP_CLIENT_SECRET environment variable is required");
  }
  if (!redirectPath) {
    throw new Error("MP_REDIRECT_URI environment variable is required");
  }

  // Resolve relative path to absolute URL for MercadoPago
  const redirectUri = redirectPath.startsWith("/")
    ? `${resolveBaseUrl(params?.origin)}${redirectPath}`
    : redirectPath;

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generates the MercadoPago authorization URL.
 * Include a unique state parameter for CSRF protection.
 */
export function getAuthorizeUrl(params: {
  config: OAuthConfig;
  state: string;
}): string {
  const { config, state } = params;

  const url = new URL(`${MP_AUTH_BASE_URL}/authorization`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Exchanges authorization code for access token.
 */
export async function exchangeCodeForToken(params: {
  config: OAuthConfig;
  code: string;
}): Promise<OAuthTokenResponse> {
  const { config, code } = params;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetchWithTimeout(`${MP_API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();
  return data as OAuthTokenResponse;
}

/**
 * Exchanges a refresh token for a new access token.
 */
export async function refreshAccessToken(params: {
  config: OAuthConfig;
  refreshToken: string;
}): Promise<OAuthTokenResponse> {
  const { config, refreshToken } = params;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetchWithTimeout(`${MP_API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  return data as OAuthTokenResponse;
}

/**
 * Fetches user info from MP API using access token.
 */
export async function getUserInfo(params: {
  accessToken: string;
}): Promise<OAuthUserInfo> {
  const { accessToken } = params;

  const response = await fetchWithTimeout(`${MP_API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch user info: ${error}`);
  }

  const data = await response.json();
  return data as OAuthUserInfo;
}

/**
 * Generates a cryptographically secure random state string for OAuth.
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
