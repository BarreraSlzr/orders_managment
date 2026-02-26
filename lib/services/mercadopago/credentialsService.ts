/**
 * credentialsService — tenant-scoped Mercado Pago credential management.
 *
 * Credentials are stored per-tenant in `mercadopago_credentials`.
 * Only one active credential record per tenant is expected. Upsert
 * deactivates any existing record before inserting a new one.
 *
 * access_token / refresh_token are encrypted at rest when
 * MP_TOKENS_ENCRYPTION_KEY (or AUTH_SECRET fallback) is configured.
 */
import {
    getOAuthConfig,
    refreshAccessToken,
} from "@/lib/services/mercadopago/oauthService";
import {
    decryptMpToken,
    encryptMpToken,
    isMpTokenEncrypted,
} from "@/lib/services/mercadopago/tokenCrypto";
import { getDb, sql } from "@/lib/sql/database";
import { MercadopagoCredentialsTable } from "@/lib/sql/types";
import { Selectable } from "kysely";

export type MpCredentials = Selectable<MercadopagoCredentialsTable>;

export interface UpsertCredentialsParams {
  tenantId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  appId: string;
  userId: string;
  contactEmail?: string | null;
}

const REFRESH_SKEW_MS = 60_000;

/**
 * Returns the active MP credentials for a tenant, or null if not configured.
 */
export async function getCredentials({
  tenantId,
}: {
  tenantId: string;
}): Promise<MpCredentials | null> {
  const row = await getDb()
    .selectFrom("mercadopago_credentials")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .where("deleted", "is", null)
    .orderBy("created", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!row) return null;

  let decrypted: MpCredentials;
  try {
    decrypted = decryptCredentialTokens(row);
    await reencryptLegacyTokens(row, decrypted);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to decrypt MP credentials";
    await getDb()
      .updateTable("mercadopago_credentials")
      .set({ status: "error", error_message: errorMessage })
      .where("id", "=", row.id)
      .execute();
    return null;
  }

  return refreshCredentialsIfNeeded(decrypted);
}

/**
 * Creates or replaces MP credentials for a tenant.
 * Soft-deletes any existing active record before inserting the new one.
 */
export async function upsertCredentials({
  tenantId,
  accessToken,
  refreshToken,
  expiresInSeconds,
  appId,
  userId,
  contactEmail,
}: UpsertCredentialsParams): Promise<MpCredentials> {
  // Soft-delete existing active credentials
  await getDb()
    .updateTable("mercadopago_credentials")
    .set({ status: "inactive" })
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .execute();

  const tokenExpiresAt =
    typeof expiresInSeconds === "number" && expiresInSeconds > 0
      ? sql<Date>`now() + (${expiresInSeconds} * interval '1 second')`
      : null;

  // Insert new credentials
  const row = await getDb()
    .insertInto("mercadopago_credentials")
    .values({
      tenant_id: tenantId,
      access_token: encryptMpToken(accessToken),
      refresh_token: refreshToken ? encryptMpToken(refreshToken) : null,
      token_expires_at: tokenExpiresAt,
      refreshed_at: refreshToken ? sql<Date>`now()` : null,
      app_id: appId,
      user_id: userId,
      contact_email: contactEmail ?? null,
      status: "active",
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return decryptCredentialTokens(row);
}

/**
 * Marks MP credentials as errored (e.g. after a failed API call).
 */
export async function markCredentialsError({
  tenantId,
  errorMessage,
}: {
  tenantId: string;
  errorMessage: string;
}): Promise<void> {
  await getDb()
    .updateTable("mercadopago_credentials")
    .set({ status: "error", error_message: errorMessage })
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .execute();
}

async function refreshCredentialsIfNeeded(
  creds: MpCredentials,
): Promise<MpCredentials> {
  if (!creds.refresh_token || !creds.token_expires_at) {
    return creds;
  }

  const expiresAt = new Date(creds.token_expires_at).getTime();
  const now = Date.now();
  if (expiresAt - now > REFRESH_SKEW_MS) {
    return creds;
  }

  try {
    const config = await getOAuthConfig();
    const refreshed = await refreshAccessToken({
      config,
      refreshToken: creds.refresh_token,
    });

    const refreshedToken = refreshed.refresh_token || creds.refresh_token;
    const tokenExpiresAt =
      typeof refreshed.expires_in === "number" && refreshed.expires_in > 0
        ? sql<Date>`now() + (${refreshed.expires_in} * interval '1 second')`
        : null;

    const updated = await getDb()
      .updateTable("mercadopago_credentials")
      .set({
        access_token: encryptMpToken(refreshed.access_token),
        refresh_token: refreshedToken ? encryptMpToken(refreshedToken) : null,
        token_expires_at: tokenExpiresAt,
        refreshed_at: sql<Date>`now()`,
        status: "active",
        error_message: null,
      })
      .where("id", "=", creds.id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) return creds;
    return decryptCredentialTokens(updated);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to refresh MP token";

    // Transient failures (network / timeout / 5xx) should NOT permanently
    // brick the credentials.  Log a warning and return the stale token so
    // the caller can still attempt the operation — MP may accept the old
    // token if it hasn't actually expired yet.
    const isTransient =
      error instanceof Error &&
      (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|abort|network|5\d\d/i.test(
        error.message,
      ) ||
        error.name === "AbortError");

    if (isTransient) {
      console.warn(
        `[mp-creds] Transient refresh failure for tenant ${creds.tenant_id}, returning stale token:`,
        errorMessage,
      );
      return creds;
    }

    // Non-transient (e.g. 401 invalid_grant) — mark credentials as error.
    await getDb()
      .updateTable("mercadopago_credentials")
      .set({
        status: "error",
        error_message: errorMessage,
      })
      .where("id", "=", creds.id)
      .execute();

    return creds;
  }
}

function decryptCredentialTokens(creds: MpCredentials): MpCredentials {
  return {
    ...creds,
    access_token: decryptMpToken(creds.access_token),
    refresh_token: creds.refresh_token ? decryptMpToken(creds.refresh_token) : null,
  };
}

async function reencryptLegacyTokens(
  stored: MpCredentials,
  decrypted: MpCredentials,
): Promise<void> {
  const needsAccessTokenReencrypt = !isMpTokenEncrypted(stored.access_token);
  const needsRefreshTokenReencrypt =
    !!stored.refresh_token && !isMpTokenEncrypted(stored.refresh_token);

  if (!needsAccessTokenReencrypt && !needsRefreshTokenReencrypt) {
    return;
  }

  const encryptedAccessToken = encryptMpToken(decrypted.access_token);
  const encryptedRefreshToken = decrypted.refresh_token
    ? encryptMpToken(decrypted.refresh_token)
    : null;

  if (encryptedAccessToken === decrypted.access_token) {
    return;
  }

  await getDb()
    .updateTable("mercadopago_credentials")
    .set({
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      refreshed_at: sql<Date>`now()`,
    })
    .where("id", "=", stored.id)
    .execute();
}
