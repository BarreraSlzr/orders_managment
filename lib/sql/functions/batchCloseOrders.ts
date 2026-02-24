"use server";

import { sql } from "kysely";
import { db } from "../database";

export interface BatchCloseResult {
  closedOrderIds: string[];
}

/**
 * Closes all still-open orders for a given calendar date (YYYY-MM-DD,
 * America/Mexico_City).  Safe to call multiple times — orders already
 * closed are ignored by the WHERE clause.
 */
export async function batchCloseOrders(params: {
  tenantId: string;
  /** YYYY-MM-DD in America/Mexico_City */
  date: string;
}): Promise<BatchCloseResult> {
  const rows = await db
    .updateTable("orders")
    .set({ closed: new Date() })
    .where("tenant_id", "=", params.tenantId)
    .where("closed", "is", null)
    .where(
      sql<string>`date(created AT TIME ZONE 'America/Mexico_City')`,
      "=",
      params.date,
    )
    .returning("id")
    .execute();

  return { closedOrderIds: rows.map((r) => r.id) };
}
