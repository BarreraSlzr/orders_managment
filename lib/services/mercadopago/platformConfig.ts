/**
 * platformConfig — DB-first Mercado Pago platform configuration.
 *
 * Reads from `mp_platform_config` (singleton row) first, then falls back to
 * process.env.* so existing deployments continue working while the DB row
 * is gradually populated via the admin workflow.
 *
 * LEGEND: Canonical MP platform config reader.
 * Always use `getMpPlatformConfig()` — never read MP_* env vars directly.
 */

import { getDb } from "@/lib/sql/database";
import { setEncryptionKeyOverride } from "./tokenCrypto";

export interface MpPlatformConfig {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  webhookSecret: string | null;
  paymentAccessToken: string | null;
  billingWebhookSecret: string | null;
  billingAccessToken: string | null;
  tokensEncryptionKey: string | null;
}

const TTL_MS = 60_000;

let _cache: { value: MpPlatformConfig; expiresAt: number } | null = null;

/**
 * Returns the current MP platform config, preferring DB over env vars.
 * Results are cached for 60 seconds to avoid DB traffic on every request.
 */
export async function getMpPlatformConfig(): Promise<MpPlatformConfig> {
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) return _cache.value;

  let dbRow: {
    client_id: string | null;
    client_secret: string | null;
    redirect_uri: string | null;
    webhook_secret: string | null;
    payment_access_token: string | null;
    billing_access_token: string | null;
    billing_webhook_secret: string | null;
    tokens_encryption_key: string | null;
  } | null = null;

  try {
    dbRow =
      (await getDb()
        .selectFrom("mp_platform_config")
        .select([
          "client_id",
          "client_secret",
          "redirect_uri",
          "webhook_secret",
          "payment_access_token",
          "billing_access_token",
          "billing_webhook_secret",
          "tokens_encryption_key",
        ])
        .where("id", "=", "singleton")
        .executeTakeFirst()) ?? null;
  } catch {
    // DB not available (e.g. during migration), fall through to env vars
  }

  const value: MpPlatformConfig = {
    clientId: dbRow?.client_id?.trim() || process.env.MP_CLIENT_ID?.trim() || null,
    clientSecret: dbRow?.client_secret?.trim() || process.env.MP_CLIENT_SECRET?.trim() || null,
    redirectUri: dbRow?.redirect_uri?.trim() || process.env.MP_REDIRECT_URI?.trim() || null,
    webhookSecret: dbRow?.webhook_secret?.trim() || process.env.MP_WEBHOOK_SECRET?.trim() || null,
    paymentAccessToken:
      dbRow?.payment_access_token?.trim() || process.env.MP_ACCESS_TOKEN?.trim() || null,
    billingAccessToken:
      dbRow?.billing_access_token?.trim() || process.env.MP_BILLING_ACCESS_TOKEN?.trim() || null,
    billingWebhookSecret:
      dbRow?.billing_webhook_secret?.trim() || process.env.MP_BILLING_WEBHOOK_SECRET?.trim() || null,
    tokensEncryptionKey:
      dbRow?.tokens_encryption_key?.trim() ||
      process.env.MP_TOKENS_ENCRYPTION_KEY?.trim() ||
      process.env.AUTH_SECRET?.trim() ||
      null,
  };

  // Propagate encryption key to tokenCrypto module so it doesn't need to
  // be async — keeps the encrypt/decrypt API simple.
  setEncryptionKeyOverride(value.tokensEncryptionKey);

  _cache = { value, expiresAt: now + TTL_MS };
  return value;
}

/**
 * Clears the in-memory cache so the next call reloads from DB.
 * Must be called after saving a new value to `mp_platform_config`.
 */
export function invalidateMpPlatformConfigCache(): void {
  _cache = null;
}
