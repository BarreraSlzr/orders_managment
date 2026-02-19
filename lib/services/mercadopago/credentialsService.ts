/**
 * credentialsService — tenant-scoped Mercado Pago credential management.
 *
 * Credentials are stored per-tenant in `mercadopago_credentials`.
 * Only one active credential record per tenant is expected. Upsert
 * deactivates any existing record before inserting a new one.
 *
 * TODO: encrypt access_token at rest before writing to DB in production.
 */
import { db } from "@/lib/sql/database";
import { MercadopagoCredentialsTable } from "@/lib/sql/types";
import { Selectable } from "kysely";

export type MpCredentials = Selectable<MercadopagoCredentialsTable>;

export interface UpsertCredentialsParams {
  tenantId: string;
  accessToken: string;
  appId: string;
  userId: string;
  contactEmail?: string | null;
}

/**
 * Returns the active MP credentials for a tenant, or null if not configured.
 */
export async function getCredentials({
  tenantId,
}: {
  tenantId: string;
}): Promise<MpCredentials | null> {
  const row = await db
    .selectFrom("mercadopago_credentials")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .where("deleted", "is", null)
    .orderBy("created", "desc")
    .limit(1)
    .executeTakeFirst();

  return row ?? null;
}

/**
 * Creates or replaces MP credentials for a tenant.
 * Soft-deletes any existing active record before inserting the new one.
 */
export async function upsertCredentials({
  tenantId,
  accessToken,
  appId,
  userId,
  contactEmail,
}: UpsertCredentialsParams): Promise<MpCredentials> {
  // Soft-delete existing active credentials
  await db
    .updateTable("mercadopago_credentials")
    .set({ status: "inactive" })
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .execute();

  // Insert new credentials
  const row = await db
    .insertInto("mercadopago_credentials")
    .values({
      tenant_id: tenantId,
      access_token: accessToken,
      app_id: appId,
      user_id: userId,
      contact_email: contactEmail ?? null,
      status: "active",
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return row;
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
  await db
    .updateTable("mercadopago_credentials")
    .set({ status: "error", error_message: errorMessage })
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .execute();
}
