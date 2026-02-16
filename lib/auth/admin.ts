export interface AdminIdentity {
  role: string;
  key: string;
  username: string;
  email: string;
}

export interface AdminConfig {
  password: string;
  apiKey: string;
  cookieName: string;
  cookieDomain: string;
}

let _adminConfig: AdminConfig | null = null;

export function getAdminConfig(): AdminConfig {
  if (_adminConfig) return _adminConfig;

  const password = process.env.ADMIN_PASSWORD || "";
  const apiKey = process.env.ADMIN_SHARED_API_KEY || "";

  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set in .env.local.");
  }
  if (!apiKey) {
    throw new Error("ADMIN_SHARED_API_KEY must be set in .env.local.");
  }

  _adminConfig = {
    password,
    apiKey,
    cookieName: process.env.ADMIN_API_KEY_COOKIE || "__admin_api_key",
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || "",
  };

  return _adminConfig;
}

export function resetAdminConfig(): void {
  _adminConfig = null;
}

export function isValidIdentity(params: { candidate: unknown }): boolean {
  if (!params.candidate || typeof params.candidate !== "object") {
    return false;
  }

  const record = params.candidate as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role.trim() : "";
  const key = typeof record.key === "string" ? record.key.trim() : "";
  const username =
    typeof record.username === "string" ? record.username.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";

  return Boolean(role && key && (username || email));
}

export function hasAdminApiKey(params: {
  authorizationHeader: string | null;
  cookieValue: string | undefined;
  apiKey: string;
}): boolean {
  if (params.cookieValue && params.cookieValue === params.apiKey) return true;
  if (!params.authorizationHeader) return false;

  const value = params.authorizationHeader.trim();
  if (!value.toLowerCase().startsWith("bearer ")) return false;
  return value.slice(7) === params.apiKey;
}
