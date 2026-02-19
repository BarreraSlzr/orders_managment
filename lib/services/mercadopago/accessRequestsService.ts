/**
 * accessRequestsService — manage Mercado Pago access requests per tenant.
 */
import { db } from "@/lib/sql/database";
import { MercadopagoAccessRequestsTable } from "@/lib/sql/types";
import { getIsoTimestamp } from "@/utils/stamp";
import { Selectable } from "kysely";

export type MpAccessRequest = Selectable<MercadopagoAccessRequestsTable>;
export type MpAccessRequestStatus = MercadopagoAccessRequestsTable["status"];

export interface GetLatestAccessRequestParams {
  tenantId: string;
}

export async function getLatestAccessRequest({
  tenantId,
}: GetLatestAccessRequestParams): Promise<MpAccessRequest | null> {
  const row = await db
    .selectFrom("mercadopago_access_requests")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("requested_at", "desc")
    .limit(1)
    .executeTakeFirst();

  return row ?? null;
}

export interface UpsertAccessRequestParams {
  tenantId: string;
  contactEmail: string;
}

export async function upsertAccessRequest({
  tenantId,
  contactEmail,
}: UpsertAccessRequestParams): Promise<MpAccessRequest> {
  const now = getIsoTimestamp();

  const existing = await db
    .selectFrom("mercadopago_access_requests")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "pending")
    .orderBy("requested_at", "desc")
    .limit(1)
    .executeTakeFirst();

  if (existing) {
    return db
      .updateTable("mercadopago_access_requests")
      .set({
        contact_email: contactEmail,
        requested_at: now,
        updated_at: now,
      })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  return db
    .insertInto("mercadopago_access_requests")
    .values({
      tenant_id: tenantId,
      contact_email: contactEmail,
      status: "pending",
      requested_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export interface CompleteAccessRequestParams {
  tenantId: string;
  contactEmail?: string | null;
}

export async function completeAccessRequest({
  tenantId,
  contactEmail,
}: CompleteAccessRequestParams): Promise<void> {
  const now = getIsoTimestamp();

  const query = db
    .updateTable("mercadopago_access_requests")
    .set({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "pending");

  if (contactEmail) {
    await query
      .where("contact_email", "=", contactEmail)
      .execute();
    return;
  }

  await query.execute();
}
