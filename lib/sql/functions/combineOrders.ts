import { db, sql } from "../database";

interface CombineOrdersParams {
  tenantId: string;
  /** The order that absorbs all items from the source orders */
  targetOrderId: string;
  /** Orders whose items are moved into targetOrderId; soft-deleted afterwards */
  sourceOrderIds: string[];
}

/**
 * Merge multiple orders into one by re-assigning all order_items from the
 * source orders to the target order, then soft-deleting the source orders.
 * Returns the updated target order row.
 */
export async function combineOrders(params: CombineOrdersParams) {
  // 1. Reassign all order_items from source orders to the target
  await db
    .updateTable("order_items")
    .set({ order_id: params.targetOrderId })
    .where("tenant_id", "=", params.tenantId)
    .where("order_id", "in", params.sourceOrderIds)
    .execute();

  // 2. Soft-delete the (now-empty) source orders.
  // BaseTable.deleted has update-type `never` by convention, so we bypass
  // Kysely's typed builder with a raw sql template instead.
  await sql`
    UPDATE orders
    SET deleted = NOW()
    WHERE tenant_id = ${params.tenantId}
      AND id IN (${sql.join(params.sourceOrderIds)})
  `.execute(db);

  // 3. Return the enriched target order
  return db
    .selectFrom("orders")
    .selectAll()
    .where("id", "=", params.targetOrderId)
    .where("tenant_id", "=", params.tenantId)
    .executeTakeFirstOrThrow();
}
