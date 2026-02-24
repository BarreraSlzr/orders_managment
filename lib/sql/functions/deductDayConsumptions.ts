"use server";

import { sql } from "kysely";
import { db } from "../database";

export interface DeductDayResult {
  itemId: string;
  itemName: string;
  quantityTypeValue: string;
  totalDeducted: number;
}

/**
 * EOD inventory reconciliation.
 *
 * For a given calendar date (YYYY-MM-DD, Mexico City timezone), finds all
 * closed orders, joins their sold products to `product_consumptions`, aggregates
 * total ingredient usage, and inserts one OUT transaction per item/unit group.
 *
 * Guards against double-runs: skips if an EOD_RECONCILE OUT transaction already
 * exists for the item on that date.
 *
 * Returns the list of deducted items so callers can show a summary.
 */
export async function deductDayConsumptions(params: {
  tenantId: string;
  /** YYYY-MM-DD in America/Mexico_City */
  date: string;
}): Promise<DeductDayResult[]> {
  // 1. Aggregate: for each (item_id, quantity_type_value) — sum quantity × times sold
  const aggregated = await db
    .selectFrom("order_items as oi")
    .innerJoin("orders as o", "o.id", "oi.order_id")
    .innerJoin("product_consumptions as pc", "pc.product_id", "oi.product_id")
    .innerJoin("inventory_items as ii", "ii.id", "pc.item_id")
    .select([
      "pc.item_id",
      "ii.name as item_name",
      "pc.quantity_type_value",
      sql<number>`sum(pc.quantity)`.as("total_qty"),
    ])
    .where("o.tenant_id", "=", params.tenantId)
    .where("oi.tenant_id", "=", params.tenantId)
    .where("pc.tenant_id", "=", params.tenantId)
    .where("o.closed", "is not", null)
    .where(
      sql<string>`date(o.closed AT TIME ZONE 'America/Mexico_City')`,
      "=",
      params.date,
    )
    .where("pc.deleted", "is", null)
    .groupBy(["pc.item_id", "ii.name", "pc.quantity_type_value"])
    .execute();

  if (aggregated.length === 0) return [];

  // 2. For each aggregated row, insert an OUT transaction unless one already
  //    exists for this item/date combo (idempotency guard).
  const results: DeductDayResult[] = [];

  for (const row of aggregated) {
    // Check if already reconciled for this item on this date
    const existing = await db
      .selectFrom("transactions")
      .select("id")
      .where("tenant_id", "=", params.tenantId)
      .where("item_id", "=", row.item_id)
      .where("type", "=", "OUT")
      .where(
        sql<string>`date(created AT TIME ZONE 'America/Mexico_City')`,
        "=",
        params.date,
      )
      .executeTakeFirst();

    if (existing) continue; // already reconciled this item today

    await db
      .insertInto("transactions")
      .values({
        tenant_id: params.tenantId,
        item_id: row.item_id,
        type: "OUT",
        quantity: row.total_qty,
        quantity_type_value: row.quantity_type_value,
        price: 0, // cost-of-goods deductions don't carry a purchase price
      })
      .execute();

    results.push({
      itemId: row.item_id,
      itemName: row.item_name,
      quantityTypeValue: row.quantity_type_value,
      totalDeducted: row.total_qty,
    });
  }

  return results;
}
